import { ConfusionMatrix } from "ml-confusion-matrix";
import { STRIDE_CODES } from "../models/StrideCategory.js";

/**
 * Berechnet Klassifikationsmetriken fuer Multi-Label-STRIDE-Ergebnisse.
 * Alle Metriken basieren auf Binary-Relevance (eine binaere Entscheidung je Klasse).
 */
export class MetricsService {
  /**
   * Berechnet Konfusionsmatrix und Metriken je STRIDE-Klasse.
   *
   * @param {import("../models/ClassificationResult.js").ClassificationResult[]} results
   * @param {Map<string, {S: boolean, T: boolean, R: boolean, I: boolean, D: boolean, E: boolean}>} labelMap
   * @returns {Record<string, {precision: number, recall: number, f1: number, accuracy: number, positives: number, tp: number, fp: number, fn: number, tn: number}>}
   */
  computePerClass(results, labelMap) {
    const predictedSets = results.map(r => new Set(r.labels));

    return Object.fromEntries(
      STRIDE_CODES.map(c => {
        const actual = results.map(r => labelMap.get(r.requirementId)?.[c] ? 1 : 0);
        const predicted = predictedSets.map(set => set.has(c) ? 1 : 0);
        const cm = ConfusionMatrix.fromLabels(actual, predicted);

        return [c, {
          precision: cm.getPositivePredictiveValue(1),
          recall: cm.getTruePositiveRate(1),
          f1: cm.getF1Score(1),
          accuracy: cm.getAccuracy(),
          positives: cm.getPositiveCount(1),
          tp: cm.getTruePositiveCount(1),
          fp: cm.getFalsePositiveCount(1),
          fn: cm.getFalseNegativeCount(1),
          tn: cm.getTrueNegativeCount(1)
        }];
      })
    );
  }

  /**
   * Berechnet Micro-F1 und Macro-F1 aus den per-Klasse-Metriken.
   *
   * Micro-F1: globale TP/FP/FN summieren -> F1 aus Summen (gewichtet nach Haeufigkeit).
   * Macro-F1: F1 je Klasse berechnen -> arithmetischer Mittelwert (jede Klasse gleich gewichtet).
   *
   * @param {ReturnType<MetricsService["computePerClass"]>} perClass Ergebnis von computePerClass().
   * @returns {{ microF1: number, macroF1: number }}
   */
  computeAggregate(perClass) {
    const values = Object.values(perClass);

    const { tp: totalTp, fp: totalFp, fn: totalFn } = values.reduce(
      (s, m) => ({ tp: s.tp + m.tp, fp: s.fp + m.fp, fn: s.fn + m.fn }),
      { tp: 0, fp: 0, fn: 0 }
    );

    const microPrecision = totalTp + totalFp > 0 ? totalTp / (totalTp + totalFp) : 0;
    const microRecall = totalTp + totalFn > 0 ? totalTp / (totalTp + totalFn) : 0;
    const microF1 = microPrecision + microRecall > 0
      ? (2 * microPrecision * microRecall) / (microPrecision + microRecall)
      : 0;

    const macroF1 = values.reduce((s, m) => s + m.f1, 0) / values.length;

    return { microF1, macroF1 };
  }

  /**
   * Berechnet Label Cardinality und Label Density nach Tsoumakas/Katakis.
   *
   * @param {Map<string, Record<string, boolean>>} labelMap
   * @returns {{ labelCardinality: number, labelDensity: number }}
   */
  computeLabelStats(labelMap) {
    const counts = [...labelMap.values()].map(
      labels => STRIDE_CODES.filter(c => labels[c]).length
    );
    const labelCardinality = counts.reduce((sum, n) => sum + n, 0) / counts.length;
    const labelDensity = labelCardinality / STRIDE_CODES.length;
    return { labelCardinality, labelDensity };
  }

}
