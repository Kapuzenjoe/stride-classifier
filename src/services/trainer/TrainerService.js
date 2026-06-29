import { ConfusionMatrix } from "ml-confusion-matrix";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { STRIDE_CODES } from "../../models/StrideCategory.js";

/**
 * Abstrakte Basisklasse fuer alle Trainer-Services.
 * Stellt den vollstaendigen Trainingslauf als Template bereit:
 *   Guard -> Einbettungsextraktion -> Labels -> _trainAlgo()-Hook -> Persistierung
 */
export class TrainerService {
  /**
   * @param {object} opts
   * @param {import("../../plugins/ClassifierPlugin.js").ClassifierPlugin} opts.classifier
   * @param {object} opts.datasets
   */
  constructor({ classifier, datasets }) {
    this.classifier = classifier;
    this.datasets = datasets;
  }

  /**
   * Vollstaendiger Trainingslauf.
   * Gemeinsame Schritte: Guard, Einbettungsextraktion, Labels, Klassengroessen.
   * Algo-spezifische Logik wird an _trainAlgo() delegiert.
   *
   * @param {object}   opts
   * @param {import("../../models/Requirement.js").Requirement[]} opts.trainRequirements
   * @param {import("../../models/Requirement.js").Requirement[]} opts.valRequirements
   * @param {Map}      opts.labelMap
   * @param {string}   opts.outputFileName
   * @param {string}   opts.containerSource  Quell-Bezeichner fuer die Modell-Metadaten.
   * @param {Map} [opts.contextByRequirement]
   * @param {Function} [opts.onProgress]
   * @param {Function} [opts.onWarning]
   */
  async train({ trainRequirements, valRequirements, labelMap, outputFileName, containerSource, contextByRequirement = null, onProgress, onWarning = null }) {
    if (trainRequirements.length === 0) throw new Error(`Trainings-Split leer – ${this.constructor.name} abgebrochen.`);

    const trainEmb = contextByRequirement
      ? await this.classifier.extractFusedEmbeddings(trainRequirements, contextByRequirement, { onProgress })
      : await this.classifier.extractEmbeddings(trainRequirements, { onProgress });
    const valEmb = contextByRequirement
      ? await this.classifier.extractFusedEmbeddings(valRequirements, contextByRequirement)
      : await this.classifier.extractEmbeddings(valRequirements);
    const embeddingDim = trainEmb[0]?.length ?? 0;

    const trainLabels = this._buildTrainLabels(trainRequirements, labelMap);
    const classSizes = Object.fromEntries(STRIDE_CODES.map(c => [c, trainLabels.filter(l => l[c]).length]));

    return this._trainAlgo({
      trainEmb, valEmb, embeddingDim,
      trainLabels, classSizes,
      valRequirements, labelMap,
      outputFileName, containerSource, onWarning
    });
  }

  /**
   * Algo-spezifischer Hook: Modell berechnen, Val-Scores bestimmen,
   * Thresholds optimieren, Modell persistieren.
   * Muss von jeder Unterklasse implementiert werden.
   * @param opts
   */
  async _trainAlgo(opts) {
    throw new Error(`${this.constructor.name} muss _trainAlgo() implementieren.`);
  }

  /**
   * Grid-Search fuer den F1-maximierenden Threshold je STRIDE-Klasse.
   * Nutzt ConfusionMatrix zur F1-Berechnung.
   * Fallback: threshold=0.5, validationF1=0 wenn keine Positiven im Validation-Set.
   *
   * @param {Array<Record<string, number>>} valScores  Score je Klasse pro Val-Anforderung.
   * @param {import("../../models/Requirement.js").Requirement[]} valReqs
   * @param {Map}      labelMap
   * @param {number[]} steps  Threshold-Kandidaten (z. B. [0, 0.01, …, 1]).
   * @returns {{ thresholds: Record<string,number>, validationF1: Record<string,number>, zeroValClasses: string[] }}
   */
  _optimizeThresholds(valScores, valReqs, labelMap, steps) {
    const thresholds = {};
    const validationF1 = {};
    const zeroValClasses = [];

    for (const code of STRIDE_CODES) {
      const truth = valReqs.map(r => labelMap.get(r.id)?.[code] ? 1 : 0);

      if (!truth.some(Boolean)) {
        zeroValClasses.push(code);
        thresholds[code] = 0.5;
        validationF1[code] = 0;
        continue;
      }

      const best = steps.reduce((acc, t) => {
        const preds = valScores.map(s => s[code] >= t ? 1 : 0);
        const score = ConfusionMatrix.fromLabels(truth, preds).getF1Score(1);
        return score > acc.f1 ? { t, f1: score } : acc;
      }, { t: 0.5, f1: 0 });

      thresholds[code] = best.t;
      validationF1[code] = best.f1;
    }

    return { thresholds, validationF1, zeroValClasses };
  }

  // ── Protected Hilfsmethoden ─────────────────────────────────────────────────

  _buildTrainLabels(requirements, labelMap) {
    return requirements.map(req => {
      const l = labelMap.get(req.id) ?? {};
      return Object.fromEntries(STRIDE_CODES.map(c => [c, l[c] ?? false]));
    });
  }

  async _saveModel(outputFileName, containerSource, payload) {
    const outputPath = path.join(this.datasets.modelsDir, outputFileName);
    await mkdir(this.datasets.modelsDir, { recursive: true });
    await writeFile(outputPath, JSON.stringify({
      classifierName: this.classifier.name,
      encoderName: this.classifier.encoderConfig.name,
      containerSource,
      modelName: this.classifier.encoderConfig.modelName,
      createdAt: new Date().toISOString(),
      ...payload
    }, null, 2), "utf-8");
    return outputPath;
  }
}
