import Papa from "papaparse";
import { readFile } from "node:fs/promises";
import { Requirement } from "../models/Requirement.js";
import { ContextElement } from "../models/ContextElement.js";
import { Relation } from "../models/Relation.js";
import { STRIDE_CODES } from "../models/StrideCategory.js";

/**
 * Verwaltet den Zugriff auf alle CSV-Eingabedaten des Prototyps.
 * Zustaendig fuer Anforderungen, Kontextelemente und Relationen.
 */
export class DatasetImportService {
  /**
   * @param {object} datasetConfig Pfade und kontrollierte Eingaben des Prototyps.
   */
  constructor(datasetConfig) {
    this.datasetConfig = datasetConfig;
  }

  /**
   * Laedt Anforderungen fuer eine beliebige konfigurierte Quelle.
   * Unterstuetzt Einzel-CSV (string) und Mehrfach-CSV (string[]).
   *
   * @param {string} sourceKey  Schluessel in `datasetConfig.sources` (z. B. "tabelle1").
   * @returns {Promise<{
   *   requirements: Requirement[],
   *   labelMap: Map<string, {S: boolean, T: boolean, R: boolean, I: boolean, D: boolean, E: boolean}>
   * }>}
   */
  async loadSourceCsv(sourceKey) {
    const source = this.datasetConfig.sources[sourceKey];
    if (!source) {
      throw new Error(
        `Unbekannte Quelle: "${sourceKey}". `
        + `Verfuegbar: ${Object.keys(this.datasetConfig.sources).join(" | ")}`
      );
    }

    const paths = Array.isArray(source.csv) ? source.csv : [source.csv];
    const results = await Promise.all(paths.map(p => this.#loadCsv(p)));

    return {
      requirements: results.flatMap(r => r.requirements),
      labelMap: new Map(results.flatMap(r => [...r.labelMap]))
    };
  }

  /**
   * Laedt Kontextelemente und Relationen fuer eine konfigurierte Quelle.
   *
   * @param {string} sourceKey  Schluessel in `datasetConfig.sources`.
   * @returns {Promise<{ contextElements: ContextElement[], relations: Relation[] }>}
   */
  async loadContextData(sourceKey) {
    const source = this.datasetConfig.sources[sourceKey];
    if (!source?.contextElements || !source?.relations) {
      return { contextElements: [], relations: [] };
    }
    return {
      contextElements: await this.#loadContextElements(source.contextElements),
      relations: await this.#loadRelations(source.relations)
    };
  }

  /**
   * Liest eine STRIDE-Anforderungs-CSV.
   * Spaltenkonvention: Spalte 0 = ID, Spalte 1 = Text, Header S/T/R/I/D/E = STRIDE-Labels.
   *
   * @param {string} filePath
   * @returns {Promise<{ requirements: Requirement[], labelMap: Map }>}
   */
  async #loadCsv(filePath) {
    const raw = await readFile(filePath, "utf-8");
    const { data } = Papa.parse(raw, {
      delimiter: "",
      skipEmptyLines: true,
      transform: val => val.trim()
    });

    const [headers, ...rows] = data;

    const labelIndices = Object.fromEntries(
      STRIDE_CODES.map(col => [col, headers.indexOf(col)])
    );

    const requirements = [];
    const labelMap = new Map();

    for (const cols of rows) {
      const id = cols[0];
      const text = cols[1];

      if (!id || !text) continue;

      requirements.push(new Requirement({ id, text, containerId: null }));
      labelMap.set(
        id,
        Object.fromEntries(
          STRIDE_CODES.map(col => [col, cols[labelIndices[col]] === "1"])
        )
      );
    }

    return { requirements, labelMap };
  }

  /**
   * Liest eine CSV-Datei und gibt alle Datenzeilen ohne Header zurueck.
   *
   * @param {string} filePath
   * @returns {Promise<string[][]>}
   */
  async #parseCsvRows(filePath) {
    const { data: [, ...rows] } = Papa.parse(await readFile(filePath, "utf-8"), {
      skipEmptyLines: true, transform: val => val.trim()
    });
    return rows;
  }

  /**
   * Liest Kontextelemente aus einer CSV-Datei.
   *
   * @param {string} filePath
   * @returns {Promise<ContextElement[]>}
   */
  async #loadContextElements(filePath) {
    const rows = await this.#parseCsvRows(filePath);
    return rows.map(([id, designation, type, content]) =>
      new ContextElement({ id, designation, type, content: { description: content } })
    );
  }

  /**
   * Liest Relationen aus einer CSV-Datei.
   *
   * @param {string} filePath
   * @returns {Promise<Relation[]>}
   */
  async #loadRelations(filePath) {
    const rows = await this.#parseCsvRows(filePath);
    return rows.map(([id, type, fromId, toId]) =>
      new Relation({ id, type, fromId, toId })
    );
  }
}
