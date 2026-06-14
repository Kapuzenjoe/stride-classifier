import { readFile } from "node:fs/promises";
import { ClassificationResult } from "../models/ClassificationResult.js";
import { STRIDE_CODES } from "../models/StrideCategory.js";

/**
 * Abstrakte Basisklasse aller Klassifikations-Plugins nach Binary-Relevance-Prinzip.
 */
export class ClassifierPlugin {
  /**
   * @param {object} opts
   * @param {string} opts.name          Technischer Bezeichner des Plugins.
   * @param {string} opts.method        Kurzbeschreibung des Verfahrens.
   * @param {import("../config/encoders.config.js").encoderConfigs[string]|null} [opts.encoderConfig]
   *   Encoder-Konfiguration; null fuer regelbasierte Plugins ohne Transformer-Einbettungen.
   * @param {string|null} [opts.modelPath]  Absoluter Pfad zur Modelldatei; null wenn kein Modell benoetigt.
   */
  constructor({ name, method, encoderConfig = null, modelPath = null }) {
    this.name = name;
    this.method = method;
    this.encoderConfig = encoderConfig;
    this.modelPath = modelPath;
    this.model = null;
    this.pipeline = null;
  }

  /**
   * Laedt die Transformer-Feature-Extraction-Pipeline einmalig (Lazy-Init).
   * Gibt null zurueck wenn kein encoderConfig gesetzt ist.
   *
   * @returns {Promise<Function|null>}
   */
  async loadPipeline() {
    if (this.pipeline !== null) return this.pipeline;
    if (this.encoderConfig === null) return null;
    try {
      const { pipeline } = await import(this.encoderConfig.library);
      this.pipeline = await pipeline(this.encoderConfig.task, this.encoderConfig.modelName);
    } catch(err) {
      throw new Error(
        `Encoder-Modell konnte nicht geladen werden: "${this.encoderConfig.modelName}"\n-> ${err.message}`
      );
    }
    return this.pipeline;
  }

  /**
   * Laedt die Modelldatei einmalig (Lazy-Init).
   *
   * @returns {Promise<object|null>} Geladenes Modell oder null.
   */
  async loadModel() {
    if (this.model !== null) return this.model;
    if (this.modelPath === null) return null;

    let raw;
    try {
      raw = JSON.parse(await readFile(this.modelPath, "utf-8"));
    } catch(err) {
      throw new Error(`${this.name}-Modell nicht lesbar: "${this.modelPath}" – ${err.message}`);
    }
    this.model = this._parseModel(raw);
    return this.model;
  }

  /**
   * Extrahiert mean-gepoolte, L2-normalisierte Einbettungen fuer alle Anforderungen.
   * Verarbeitet den Input in Batches der Groesse encoderConfig.batchSize.
   * Falls encoderConfig.inputPrefix gesetzt ist, wird er jedem Text vorangestellt.
   *
   * @param {import("../models/Requirement.js").Requirement[]} requirements
   * @param {object}   [opts]
   * @param {Function} [opts.onProgress]  Callback(done: number, total: number) nach jedem Batch.
   * @returns {Promise<Float32Array[]>}   Eine Einbettung pro Anforderung (Dimension modellabhaengig).
   */
  async extractEmbeddings(requirements, { onProgress } = {}) {
    const extractor = await this.loadPipeline();
    if (extractor === null) throw new Error(`${this.name}: extractEmbeddings() benötigt einen encoderConfig.`);
    const batchSize = this.encoderConfig.batchSize;
    const prefix = this.encoderConfig.inputPrefix ?? "";
    const total = requirements.length;
    const embeddings = [];

    for (let start = 0; start < total; start += batchSize) {
      const batch = requirements.slice(start, start + batchSize);
      const texts = batch.map(r => `${prefix}${r.text}`);
      const tensor = await extractor(texts, this.encoderConfig.extractionOptions);
      const dim = tensor.dims.at(-1);

      for (let j = 0; j < batch.length; j++) {
        embeddings.push(tensor.data.slice(j * dim, (j + 1) * dim));
      }

      onProgress?.(Math.min(start + batchSize, total), total);
    }

    return embeddings;
  }

  /**
   * Klassifiziert Anforderungen und gibt je Anforderung ein Zuordnungsergebnis
   * mit vorhergesagten Labels und klassenweisen Zuordnungswerten zurueck.
   *
   * @param {import("../models/Requirement.js").Requirement[]} requirements
   * @returns {Promise<ClassificationResult[]>}
   */
  async classify(requirements) {
    const model = await this.loadModel();
    const embeddings = await this.extractEmbeddings(requirements);

    return requirements.map((req, i) => {
      const scores = this._scoreAll(embeddings[i], model);
      const labels = STRIDE_CODES
        .filter(code => scores[code] >= model.thresholds[code]);

      return new ClassificationResult({
        requirementId: req.id,
        containerId: req.containerId,
        labels,
        scores,
        classifier: { name: this.name, method: this.method, modelName: model.modelName }
      });
    });
  }

  /**
   * Validiert und transformiert das rohe Modell-JSON.
   * Standardimplementierung gibt raw unveraendert zurueck.
   *
   * @param {object} raw  Geparstes JSON aus der Modelldatei.
   * @returns {object}
   */
  _parseModel(raw) { return raw; }

  /**
   * Berechnet klassenweise Zuordnungswerte fuer eine einzelne Einbettung.
   * Muss von jedem ML-Plugin implementiert werden.
   *
   * @param {Float32Array} embedding  L2-normalisierte Einbettung der Anforderung.
   * @param {object}       model      Geladenes Modell (Ausgabe von _parseModel).
   * @returns {Record<string, number>}  STRIDE-Code -> Zuordnungswert.
   */
  _scoreAll(embedding, model) {
    throw new Error(`${this.constructor.name} muss _scoreAll() implementieren.`);
  }
}
