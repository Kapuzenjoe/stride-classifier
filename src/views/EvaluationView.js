import { STRIDE_CODES } from "../models/StrideCategory.js";

/**
 * Rendert Evaluationsergebnisse als Konsolentabellen.
 */
export class EvaluationView {
  /**
   * Gibt die vollständige Evaluationstabelle aus.
   *
   * @param {object} payload
   * @param {string}  payload.classifierName   Name des Klassifikators.
   * @param {string}  payload.splitName        Bezeichnung des Splits (z. B. "test" oder "CV-Mittel").
   * @param {number}  payload.splitSize        Anzahl der Anforderungen im Split.
   * @param {object}  payload.perClass         Ausgabe von MetricsService.computePerClass().
   * @param {number}  payload.microF1          Micro-F1-Wert.
   * @param {number}  payload.macroF1          Macro-F1-Wert.
   * @param {string}  [payload.resultPath]     Pfad der geschriebenen Ergebnis-JSON.
   */
  renderEvaluationTable({
    classifierName, splitName, splitSize,
    perClass, microF1, macroF1,
    resultPath
  }) {
    const div = "─".repeat(58);

    console.log(`\n${div}`);
    console.log(` Evaluation – ${classifierName}`);
    console.log(` Split: ${splitName}  (n=${splitSize})`);
    console.log(div);

    // Per-Klasse-Tabelle
    console.log(" Klasse  Prec   Rec    F1     Acc    Positiv   TP   FP   FN");
    console.log(` ${"─".repeat(63)}`);
    for (const c of STRIDE_CODES) {
      const m = perClass[c];
      console.log(
        ` ${c.padEnd(7)} ${this.#pct(m.precision)}  ${this.#pct(m.recall)}  ${this.#pct(m.f1)}`
        + `  ${this.#pct(m.accuracy)}  ${String(m.positives).padStart(7)}`
        + `  ${String(m.tp).padStart(4)} ${String(m.fp).padStart(4)} ${String(m.fn).padStart(4)}`
      );
    }

    // Aggregat
    console.log(` ${"─".repeat(56)}`);
    console.log(` Micro-F1  ${this.#pct(microF1)}`);
    console.log(` Macro-F1  ${this.#pct(macroF1)}`);

    console.log(div);
    if (resultPath) console.log(` Ergebnisse: ${resultPath}`);
  }

  /**
   * Formatiert eine Zahl als dreistellige Dezimalzahl.
   * @param {number} value
   * @returns {string}
   */
  #pct(value) {
    return value.toFixed(3);
  }
}
