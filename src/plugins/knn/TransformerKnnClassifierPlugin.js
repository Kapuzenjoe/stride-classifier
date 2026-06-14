import { ClassifierPlugin } from "../ClassifierPlugin.js";
import { STRIDE_CODES } from "../../models/StrideCategory.js";
import { dot, topKIndices } from "../../utils/embedding.js";
import { ClassifierName } from "../../config/classifiers.config.js";

/**
 * KNN-Klassifikator nach Binary-Relevance-Prinzip.
 * Zuordnungswert je STRIDE-Klasse ist der Anteil positiver Labels  unter den k naechsten Nachbarn (Cosine-Ähnlichkeit).
 * k wird klassenindividuell per F1-maximierender Gittersuche bestimmt.
 */
export class TransformerKnnClassifierPlugin extends ClassifierPlugin {
  /**
   * @param {object} opts
   * @param {import("../../config/encoders.config.js").encoderConfigs[string]} opts.encoderConfig
   * @param {string} opts.modelPath  Absoluter Pfad zur Modelldatei.
   */
  constructor({ encoderConfig, modelPath }) {
    super({
      name: ClassifierName.KNN,
      method: `kNN classifier (${encoderConfig.modelName}, cosine similarity, k per class, Binary Relevance)`,
      encoderConfig,
      modelPath
    });
  }

  /**
   * Validiert das kNN-Modell und konvertiert Trainingseinbettungen in Float32Arrays
   * fuer den nachfolgenden Klassifikationsschritt.
   *
   * @param {{ trainEmbeddings: number[][], trainLabels: Record<string, boolean>[], thresholds: Record<string, number>, k: Record<string, number>, modelName: string }} raw
   * @returns {object}
   */
  _parseModel(raw) {
    return { ...raw, trainEmbeddings: raw.trainEmbeddings.map(e => new Float32Array(e)) };
  }

  /**
   * Berechnet den Anteil positiver Nachbarn je STRIDE-Klasse als Zuordnungswert.
   *
   * @param {Float32Array} embedding  L2-normalisierte Einbettung der Anforderung.
   * @param {object}       model      Geladenes kNN-Modell.
   * @returns {Record<string, number>}  STRIDE-Code -> Zuordnungswert ∈ [0, 1].
   */
  _scoreAll(embedding, model) {
    const sims = model.trainEmbeddings.map(te => dot(embedding, te));
    const maxK = Math.max(...Object.values(model.k));
    const topIdx = topKIndices(sims, maxK);

    return Object.fromEntries(
      STRIDE_CODES.map(code => {
        const kNeighbors = model.k[code];
        const pos = topIdx.slice(0, kNeighbors).filter(idx => model.trainLabels[idx][code]).length;
        return [code, pos / kNeighbors];
      })
    );
  }
}
