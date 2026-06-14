import { STRIDE_CODES } from "../models/StrideCategory.js";
import { ClassifierName } from "../config/classifiers.config.js";

/**
 * Gibt den aktuellen Prototypstatus auf der Konsole aus.
 */
export class ConsoleView {
  /** Kurzbezeichnungen je Klassifikator. */
  static #LABELS = {
    [ClassifierName.KNN]: "kNN",
    [ClassifierName.SVM]: "SVM",
    [ClassifierName.CENTROID]: "Centroid",
    [ClassifierName.RULE_BASED]: "Rule-Based"
  };

  /**
   * @param {object} payload
   * @param {import("../models/RequirementContainer.js").RequirementContainer} payload.container
   * @param {string} payload.outputPath Pfad zur gespeicherten JSON-Datei.
   */
  renderBuildResult({ container, outputPath }) {
    console.log("Container built:");
    console.log(`- id:              ${container.id}`);
    console.log(`- name:            ${container.name}`);
    console.log(`- requirements:    ${container.requirements.length}`);
    console.log(`- contextElements: ${container.contextElements.length}`);
    console.log(`- relations:       ${container.relations.length}`);
    console.log(`- output:          ${outputPath}`);
  }

  /**
   * @param {object} payload
   * @param {number} payload.labelCardinality Durchschnittliche Anzahl aktiver Labels je Anforderung.
   * @param {number} payload.labelDensity     Label Cardinality normiert auf die Anzahl STRIDE-Klassen.
   */
  renderLabelStats({ labelCardinality, labelDensity }) {
    console.log(`- Label Cardinality: ${labelCardinality.toFixed(3)}`);
    console.log(`- Label Density:     ${labelDensity.toFixed(3)}`);
  }

  /**
   * Gibt eine kompakte Zusammenfassung eines Klassifikationslaufs aus.
   *
   * @param {object} payload
   * @param {number} payload.withLabel       Anzahl der Anforderungen mit mindestens einem Label.
   * @param {number} payload.total           Gesamtanzahl der Anforderungen.
   * @param {string} payload.classifierName  Name des verwendeten Klassifikators.
   * @param {import("../models/RequirementContainer.js").RequirementContainer} payload.container
   * @param {string|null} payload.resultPath     Pfad zur JSON-Ergebnisdatei.
   * @param {string|null} payload.labelCsvPath   Pfad zur Vorhersage-CSV (optional).
   */
  renderClassifySummary({ withLabel, total, classifierName, container, resultPath, labelCsvPath = null }) {
    console.log(`\nClassify – ${classifierName}`);
    console.log(`Container:  ${container.name}`);
    console.log(`Gesamt:     ${total} Anforderungen`);
    console.log(`Mit Label:  ${withLabel} (${((withLabel / total) * 100).toFixed(1)} %)`);
    if (resultPath) console.log(`\nErgebnisse (JSON): ${resultPath}`);
    if (labelCsvPath) console.log(`Labels (CSV):      ${labelCsvPath}`);
  }

  /**
   * Gibt die Kontextanreicherungs-Abdeckung aus.
   *
   * @param {object} payload
   * @param {number} payload.enriched Anzahl angereicherter Anforderungen.
   * @param {number} payload.total    Gesamtanzahl der Anforderungen.
   */
  renderContextCoverage({ enriched, total }) {
    const pct = total > 0 ? ((enriched / total) * 100).toFixed(1) : "0.0";
    console.log(` Kontext: ${enriched}/${total} Anforderungen angereichert (${pct} %)`);
  }

  /**
   * @param {object} payload
   * @param {string} payload.containerName Name des Containers.
   * @param {string} payload.classifierName
   * @param {number} payload.total         Anzahl der Anforderungen.
   */
  renderTrainStart({ containerName, classifierName, total }) {
    const label = ConsoleView.#LABELS[classifierName] ?? classifierName;
    console.log(`\n${label}-Training gestartet`);
    console.log(`Container: ${containerName} (${total} Anforderungen)`);
    console.log("Embeddings werden extrahiert...");
  }

  /**
   * Überschreibt die aktuelle Zeile mit dem Fortschrittsstand.
   * @param {number} done  Verarbeitete Anforderungen.
   * @param {number} total Gesamtanzahl.
   */
  renderTrainProgress(done, total) {
    const pct = Math.round((done / total) * 100);
    process.stdout.write(`\r  ${done}/${total} (${pct} %)   `);
    if (done >= total) process.stdout.write("\n");
  }

  /**
   * Gibt eine Trainings-Warnung aus.
   * @param {string} message Formatierte Warnmeldung.
   */
  renderTrainWarning(message) {
    process.stdout.write(`  ⚠ ${message}\n`);
  }

  /**
   * Gibt das Trainingsergebnis aus.
   *
   * @param {object} payload
   * @param {string} payload.classifierName
   * @param {string} payload.outputPath
   * @param {Record<string,number>} payload.classSizes
   * @param {Record<string,number>} [payload.thresholds]
   * @param {Record<string,number>} [payload.validationF1]
   * @param {Record<string,number>|null} [payload.k]  kNN: klassenindividuelle k-Werte.
   */
  renderTrainResult({ classifierName, outputPath, classSizes, thresholds = null, validationF1 = null, k = null }) {
    const label = classifierName === ClassifierName.KNN
      ? this.#formatKnnLabel(k)
      : (ConsoleView.#LABELS[classifierName] ?? classifierName);

    console.log(`\n${label} – Validation-Set (per Klasse):`);

    const hasThresholds = thresholds !== null;
    const hasValF1 = validationF1 !== null;
    const header = `  Klasse  Trainingsbeispiele${hasThresholds ? "  Threshold" : ""}${hasValF1 ? "  Val-F1" : ""}`;
    console.log(header);

    for (const code of STRIDE_CODES) {
      const size = String(classSizes[code]).padStart(3);
      const thr = hasThresholds ? `  ${(thresholds[code] ?? 0).toFixed(2)}      ` : "";
      const f1v = hasValF1 ? `  ${(validationF1[code] ?? 0).toFixed(2)}` : "";
      console.log(`  ${code}       ${size}               ${thr}${f1v}`);
    }
    console.log(`\nModell gespeichert: ${outputPath}`);
  }

  // ── Private Hilfsmethoden ───────────────────────────────────────────────────

  /**
   * Formatiert die kNN-Bezeichnung mit klassenindividuellen k-Werten.
   *
   * @param {Record<string,number>|null} k
   * @returns {string}
   */
  #formatKnnLabel(k) {
    if (k === null) return "kNN";
    if (typeof k === "object") return `kNN (k=${Object.entries(k).map(([c, v]) => `${c}:${v}`).join(",")})`;
    return `kNN (k=${k})`;
  }
}
