import path from "node:path";
import { fileURLToPath } from "node:url";

const configDirectory = path.dirname(fileURLToPath(import.meta.url));
const prototypeRoot = path.resolve(configDirectory, "../..");
const projectRoot = path.resolve(prototypeRoot, "..");
const testDataRoot = path.join(projectRoot, "07_Testdaten");
const dataRoot = path.join(prototypeRoot, "data");

/**
 * Quell-Konfiguration je Datensatz.
 * csv:             Pfad zur Anforderungs-CSV (oder Array bei mehreren Dateien).
 * contextElements: Pfad zur Context-Elements-CSV (null wenn nicht vorhanden).
 * relations:       Pfad zur Relations-CSV (null wenn nicht vorhanden).
 */
export const datasets = {
  sources: {
    "ext1-ctx": {
      csv: path.join(testDataRoot, "Anforderung-Tabelle 1.csv"),
      contextElements: path.join(testDataRoot, "Anforderung-Tabelle 1_context-elements.csv"),
      relations: path.join(testDataRoot, "Anforderung-Tabelle 1_relations.csv"),
      label: "Externe Testdaten (mit Kontext) – Anforderung-Tabelle Systemanteil A"
    },
    "ext2-plain": {
      csv: [path.join(testDataRoot, "Anforderung-Tabelle 2_Testdaten.csv")],
      contextElements: null,
      relations: null,
      label: "Externe Testdaten (ohne Kontext) – Anforderung-Tabelle PM-System"
    },
    train: {
      csv: path.join(testDataRoot, "Anforderung-Tabelle 3_Testdaten.csv"),
      contextElements: path.join(testDataRoot, "Anforderung-Tabelle 3_context-elements.csv"),
      relations: path.join(testDataRoot, "Anforderung-Tabelle 3_relations.csv"),
      label: "Trainingsdaten – Anforderung-Tabelle FMN"
    }
  },

  containerOutputDir: path.join(dataRoot, "containers"),
  resultsDir: path.join(dataRoot, "results"),
  modelsDir: path.join(dataRoot, "models")
};
