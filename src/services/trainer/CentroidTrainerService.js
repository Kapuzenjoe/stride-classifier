import { TrainerService } from "./TrainerService.js";
import { STRIDE_CODES } from "../../models/StrideCategory.js";
import { dot, normalizedMean, centerScores } from "../../utils/embedding.js";

/**
 * Rocchio-Klassifikator (NCC): Berechnet Klassen-Centroide aus Trainings-Einbettungen
 * und optimiert STRIDE-Klassenschwellenwerte auf dem Validation-Set.
 */
export class CentroidTrainerService extends TrainerService {

  async _trainAlgo({ trainEmb, valEmb, embeddingDim, trainLabels, classSizes,
    valRequirements, labelMap, outputFileName, containerSource, onWarning }) {

    // Indizes positiver Beispiele je Klasse
    const positiveIndices = Object.fromEntries(STRIDE_CODES.map(c => [c, []]));
    trainLabels.forEach((l, i) => {
      for (const code of STRIDE_CODES) { if (l[code]) positiveIndices[code].push(i); }
    });

    // Centroide: L2-normierter Mittelwert der positiven Trainings-Einbettungen
    const centroids = Object.fromEntries(STRIDE_CODES.map(code => [
      code,
      positiveIndices[code].length > 0
        ? normalizedMean(positiveIndices[code].map(i => trainEmb[i]))
        : new Array(embeddingDim).fill(0)
    ]));

    // Val-Scores: Cosine-Aehnlichkeit je Klasse
    const centroidF32 = Object.fromEntries(STRIDE_CODES.map(c => [c, new Float32Array(centroids[c])]));
    const valScores = valEmb.map(e => centerScores(Object.fromEntries(
      STRIDE_CODES.map(c => [c, dot(e, centroidF32[c])])
    )));

    const steps = Array.from({ length: 201 }, (_, i) => (i / 100) - 1);
    const { thresholds, validationF1, zeroValClasses } =
      this._optimizeThresholds(valScores, valRequirements, labelMap, steps);
    if (zeroValClasses.length > 0) {
      onWarning?.(`Val-Set: Klasse(n) [${zeroValClasses.join(", ")}] ohne positive Beispiele -> Threshold-Fallback 0.5`);
    }

    const outputPath = await this._saveModel(outputFileName, containerSource, {
      embeddingDim, classSizes, thresholds, centroids
    });

    return { outputPath, classSizes, thresholds, validationF1 };
  }

}
