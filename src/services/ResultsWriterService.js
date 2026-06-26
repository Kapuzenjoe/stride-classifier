import Papa from "papaparse";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { STRIDE_CODES } from "../models/StrideCategory.js";

/**
 * Persistiert Klassifikationsergebnisse als strukturierte JSON-Datei.
 * Eine Datei pro Klassifikatorlauf unter data/results/.
 */
export class ResultsWriterService {
  /**
   * @param {object} datasetConfig Pfade aus datasets.config.js.
   */
  constructor(datasetConfig) {
    this.datasetConfig = datasetConfig;
  }

  /**
   * Schreibt Klassifikationsergebnisse inkl. Ground-Truth in eine JSON-Datei.
   * Dateiname-Schema: results.<source>.<classifier>[.<encoder>].json
   *
   * @param {object} options
   * @param {string}  options.classifierName  Name des Klassifikators.
   * @param {string}  [options.encoderName]   Name des Encoders (entfaellt bei rule-based).
   * @param {string}  options.containerPath   Pfad zur verwendeten Container-JSON.
   * @param {import("../models/ClassificationResult.js").ClassificationResult[]} options.results
   * @param {Map<string, object>} options.labelMap  Ground-Truth je Anforderungs-ID.
   * @param {Map<string, string>} options.textMap   Anforderungstext je ID.
   * @param options.useNdd
   * @returns {Promise<string>} Absoluter Pfad der geschriebenen Datei.
   */
  async write({ classifierName, encoderName, containerPath, results, labelMap, textMap, useNdd = false }) {
    await mkdir(this.datasetConfig.resultsDir, { recursive: true });

    const serialized = results.map(r => ({
      requirementId: r.requirementId,
      text: textMap.get(r.requirementId) ?? "",
      predictedLabels: Object.fromEntries(STRIDE_CODES.map(c => [c, r.labels.includes(c)])),
      scores: r.scores,
      trueLabels: labelMap.get(r.requirementId) ?? null
    }));

    const source = path.basename(containerPath, ".json").replace(/^container\./, "");
    const filePath = path.join(
      this.datasetConfig.resultsDir,
      `results.${source}${useNdd ? ".ndd" : ""}.${classifierName}${encoderName ? `.${encoderName}` : ""}.json`
    );
    await writeFile(filePath, JSON.stringify({
      classifier: classifierName, containerPath,
      createdAt: new Date().toISOString(),
      results: serialized
    }, null, 2), "utf-8");

    return filePath;
  }

  /**
   * Schreibt eine einfache Vorhersage-CSV: ID; Text; S; T; R; I; D; E.
   *
   * @param {object} options
   * @param {import("../models/ClassificationResult.js").ClassificationResult[]} options.results
   * @param {Map<string, string>} options.textMap      Anforderungstext je ID.
   * @param {string} options.outputFileName            Dateiname oder absoluter Pfad.
   * @returns {Promise<string>} Absoluter Pfad der geschriebenen Datei.
   */
  async writeLabelCsv({ results, textMap, outputFileName }) {
    await mkdir(this.datasetConfig.resultsDir, { recursive: true });

    const csvData = results.map(r => {
      const labelSet = new Set(r.labels);
      return {
        ID: r.requirementId,
        Text: textMap.get(r.requirementId) ?? "",
        ...Object.fromEntries(
          STRIDE_CODES.flatMap(c => [
            [c, labelSet.has(c) ? 1 : 0],
            [`${c}_Zuordnungswert`, (r.scores?.[c] ?? 0).toFixed(2)]
          ])
        )
      };
    });

    await writeFile(outputFileName, Papa.unparse(csvData, { delimiter: ";" }), "utf-8");
    return outputFileName;
  }

}
