import { ClassifierPlugin } from "../ClassifierPlugin.js";
import { STRIDE_CODES } from "../../models/StrideCategory.js";
import { ClassifierName } from "../../config/classifiers.config.js";
import { linearScore } from "../../utils/embedding.js";

/**
 * SVM-Klassifikator mit linearem Kernel nach Binary-Relevance-Prinzip.
 * Zuordnungswert je STRIDE-Klasse ist der Sigmoid-transformierte Hyperebenenabstand (score_l ∈ (0, 1)).
 */
export class TransformerSvmClassifierPlugin extends ClassifierPlugin {
  /**
   * @param {object} opts
   * @param {import("../../config/encoders.config.js").encoderConfigs[string]} opts.encoderConfig
   * @param {string} opts.modelPath  Absoluter Pfad zur Modelldatei.
   */
  constructor({ encoderConfig, modelPath }) {
    super({
      name: ClassifierName.SVM,
      method: `SVM classifier (${encoderConfig.modelName}, linear kernel, Binary Relevance)`,
      encoderConfig,
      modelPath
    });
  }

  /**
   * Berechnet den Sigmoid-Zuordnungswert je STRIDE-Klasse.
   *
   * @param {Float32Array} embedding  L2-normalisierte Einbettung der Anforderung.
   * @param {object}       model      Geladenes SVM-Modell.
   * @returns {Record<string, number>}  STRIDE-Code -> Zuordnungswert ∈ (0, 1).
   */
  _scoreAll(embedding, model) {
    return Object.fromEntries(
      STRIDE_CODES.map(code => [code, linearScore(embedding, model.svmModels[code])])
    );
  }
}
