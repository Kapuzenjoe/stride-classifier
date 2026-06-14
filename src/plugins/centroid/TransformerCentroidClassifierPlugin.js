import { ClassifierPlugin } from "../ClassifierPlugin.js";
import { STRIDE_CODES } from "../../models/StrideCategory.js";
import { dot } from "../../utils/embedding.js";
import { ClassifierName } from "../../config/classifiers.config.js";

/**
 * Rocchio-Klassifikator (NCC) nach Binary-Relevance-Prinzip.
 * Zuordnungswert je STRIDE-Klasse ist die Cosine-Aehnlichkeit zum L2-normierten Klassencentroid.
 */
export class TransformerCentroidClassifierPlugin extends ClassifierPlugin {
  /**
   * @param {object} opts
   * @param {import("../../config/encoders.config.js").encoderConfigs[string]} opts.encoderConfig
   * @param {string} opts.modelPath  Absoluter Pfad zur Centroid-Modelldatei (JSON).
   */
  constructor({ encoderConfig, modelPath }) {
    super({
      name: ClassifierName.CENTROID,
      method: `Centroid classifier (${encoderConfig.modelName}, cosine similarity, Binary Relevance)`,
      encoderConfig,
      modelPath
    });
  }

  /**
   * Konvertiert Klassencentroide in Float32Arrays.
   *
   * @param {{ centroids: Record<string, number[]>, thresholds: Record<string, number>, modelName: string }} raw
   * @returns {object}
   */
  _parseModel(raw) {
    const centroids = Object.fromEntries(
      STRIDE_CODES.map(c => [c, new Float32Array(raw.centroids[c])])
    );
    return { ...raw, centroids };
  }

  /**
   * Berechnet die Cosine-Aehnlichkeit der Anforderungseinbettung zum Klassencentroid je STRIDE-Klasse.
   *
   * @param {Float32Array} embedding  L2-normalisierte Einbettung der Anforderung.
   * @param {object}       model      Geladenes Centroid-Modell.
   * @returns {Record<string, number>}  STRIDE-Code -> Zuordnungswert ∈ [-1, 1].
   */
  _scoreAll(embedding, model) {
    return Object.fromEntries(
      STRIDE_CODES.map(code => [code, dot(embedding, model.centroids[code])])
    );
  }
}
