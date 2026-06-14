import { TrainerService } from "./TrainerService.js";
import SVM from "ml-svm";
import { STRIDE_CODES } from "../../models/StrideCategory.js";
import { linearScore } from "../../utils/embedding.js";

/**
 * SVM-Klassifikator: Trainiert je STRIDE-Klasse eine lineare SVM (Binary Relevance)
 * und optimiert Sigmoid-Konfidenzschwellenwerte auf dem Validation-Set.
 */
export class SvmTrainerService extends TrainerService {

  async _trainAlgo({ trainEmb, valEmb, embeddingDim, trainLabels, classSizes,
    valRequirements, labelMap, outputFileName, containerSource, onWarning }) {

    const trainX = trainEmb.map(e => Array.from(e));

    // Binary Relevance: eine lineare SVM je STRIDE-Klasse
    const svmModels = {};
    for (const code of STRIDE_CODES) {
      const y = trainLabels.map(l => (l[code] ? 1 : -1));
      const svm = new SVM({ C: 1, kernel: "linear", whitening: false });
      svm.train(trainX, y);
      svmModels[code] = svm.toJSON();
    }

    // Val-Scores: Sigmoid-Konfidenz je Klasse
    const valX = valEmb.map(e => Array.from(e));
    const valScores = valX.map(x => Object.fromEntries(
      STRIDE_CODES.map(c => [c, linearScore(x, svmModels[c])])
    ));

    const steps = Array.from({ length: 101 }, (_, i) => i / 100);
    const { thresholds, validationF1, zeroValClasses } = this._optimizeThresholds(valScores, valRequirements, labelMap, steps);
    if (zeroValClasses.length > 0) onWarning?.(
      `Val-Set: Klasse(n) [${zeroValClasses.join(", ")}] ohne positive Beispiele -> Threshold-Fallback 0.5`
    );

    const outputPath = await this._saveModel(outputFileName, containerSource, {
      embeddingDim, classSizes, thresholds, validationF1, svmModels
    });

    return { outputPath, classSizes, thresholds, validationF1 };
  }

}
