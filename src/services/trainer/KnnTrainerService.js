import { TrainerService } from "./TrainerService.js";
import { STRIDE_CODES } from "../../models/StrideCategory.js";
import { dot, topKIndices } from "../../utils/embedding.js";

/**
 * KNN-Trainer: optimiert k und Schwellenwerte je STRIDE-Klasse per Grid-Search auf dem Validation-Set.
 */
export class KnnTrainerService extends TrainerService {
  /**
   * Kandidaten-k-Werte fuer die klassenindividuelle Grid-Suche.
   */
  static #K_GRID = [5, 7, 11];

  constructor({ classifier, datasets, k = null }) {
    super({ classifier, datasets });
    this.kGrid = k !== null ? [k] : KnnTrainerService.#K_GRID;
  }

  async _trainAlgo({ trainEmb, valEmb, embeddingDim, trainLabels, classSizes,
    valRequirements, labelMap, outputFileName, containerSource, onWarning }) {

    const trainEmbF32 = trainEmb.map(e => new Float32Array(e));

    // Aehnlichkeiten einmal berechnen (val × train) – Grundlage fuer alle k-Werte
    const allSims = valEmb.map(emb => trainEmbF32.map(te => dot(emb, te)));

    // Fuer jedes k: Val-Scores berechnen und Thresholds optimieren
    const kResults = this.kGrid.map(k => {
      const valScores = allSims.map(sims => {
        const topIdx = topKIndices(sims, k);
        return Object.fromEntries(STRIDE_CODES.map(c => [
          c, topIdx.filter(i => trainLabels[i][c]).length / k
        ]));
      });
      const steps = Array.from({ length: k + 1 }, (_, i) => i / k);
      return { k, ...this._optimizeThresholds(valScores, valRequirements, labelMap, steps) };
    });

    // Pro Klasse: k mit hoechstem Val-F1 waehlen
    const kPerClass = Object.fromEntries(STRIDE_CODES.map(c => {
      const best = kResults.reduce((a, b) => (b.validationF1[c] ?? 0) > (a.validationF1[c] ?? 0) ? b : a);
      return [c, best.k];
    }));
    const kResultByK = new Map(kResults.map(r => [r.k, r]));
    const thresholds = Object.fromEntries(STRIDE_CODES.map(c =>
      [c, kResultByK.get(kPerClass[c]).thresholds[c]]
    ));
    const validationF1 = Object.fromEntries(STRIDE_CODES.map(c =>
      [c, kResultByK.get(kPerClass[c]).validationF1[c]]
    ));
    const zeroValClasses = kResults[0].zeroValClasses;

    if (zeroValClasses.length > 0) {
      onWarning?.(`Val-Set: Klasse(n) [${zeroValClasses.join(", ")}] ohne positive Beispiele -> Threshold-Fallback 0.5`);
    }

    const outputPath = await this._saveModel(outputFileName, containerSource, {
      k: kPerClass,
      embeddingDim, classSizes, thresholds,
      trainEmbeddings: trainEmb.map(e => Array.from(e)),
      trainLabels
    });

    return { outputPath, classSizes, thresholds, validationF1, k: kPerClass };
  }
}
