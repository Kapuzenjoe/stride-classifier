import { TrainerService } from "./TrainerService.js";
import SVM from "ml-svm";
import { STRIDE_CODES } from "../../models/StrideCategory.js";
import { linearScore } from "../../utils/embedding.js";

/**
 * SVM-Klassifikator: Trainiert je STRIDE-Klasse eine lineare SVM (Binary Relevance)
 * und optimiert Sigmoid-Konfidenzschwellenwerte auf dem Validation-Set.
 */
export class SvmTrainerService extends TrainerService {
  /** Kandidaten-C-Werte fuer die Gittersuche. */
  static #C_GRID = [0.1, 1, 10];

  async _trainAlgo({ trainEmb, valEmb, embeddingDim, trainLabels, classSizes,
    valRequirements, labelMap, outputFileName, containerSource, useNdd, onWarning }) {

    const trainX = trainEmb.map(e => Array.from(e));
    const valX = valEmb.map(e => Array.from(e));
    const steps = Array.from({ length: 101 }, (_, i) => i / 100);

    // Fuer jedes C: SVMs trainieren, mittlere Val-F1 bestimmen, bestes C waehlen
    const candidates = SvmTrainerService.#C_GRID.map(C => {
      const svmModels = Object.fromEntries(STRIDE_CODES.map(code => {
        const y = trainLabels.map(l => (l[code] ? 1 : -1));
        const svm = new SVM({ C, kernel: "linear", whitening: false });
        svm.train(trainX, y);
        return [code, svm.toJSON()];
      }));
      const valScores = valX.map(x => Object.fromEntries(STRIDE_CODES.map(c => [c, linearScore(x, svmModels[c])])));
      const { thresholds, validationF1, zeroValClasses } = this._optimizeThresholds(valScores, valRequirements, labelMap, steps);
      const macroF1 = STRIDE_CODES.reduce((sum, c) => sum + validationF1[c], 0) / STRIDE_CODES.length;
      return { C, svmModels, thresholds, validationF1, zeroValClasses, macroF1 };
    });
    const { C, svmModels, thresholds, validationF1, zeroValClasses } = candidates.reduce((a, b) => b.macroF1 > a.macroF1 ? b : a);

    if (zeroValClasses.length > 0) onWarning?.(
      `Val-Set: Klasse(n) [${zeroValClasses.join(", ")}] ohne positive Beispiele -> Threshold-Fallback 0.5`
    );

    const outputPath = await this._saveModel(outputFileName, containerSource, useNdd, {
      C, embeddingDim, classSizes, thresholds, validationF1, svmModels
    });

    return { outputPath, classSizes, thresholds, validationF1, C };
  }

}
