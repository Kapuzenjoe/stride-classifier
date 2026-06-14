/**
 * Konfigurationen aller verfügbaren Encoder-Modelle.
 *
 * Auswahl über CLI-Flag --encoder <name>.
 * Jeder Eintrag muss vollstaendig sein – alle Felder werden von
 * ClassifierPlugin.loadPipeline() und ClassifierPlugin.extractEmbeddings() ausgelesen.
 */

export const EncoderName = Object.freeze({
  JINA_DE: "jina-de",
  E5_LARGE: "e5-large",
  BGE_M3: "bge-m3"
});

/**
 * @type {Record<string, {
 *   name: string,
 *   modelName: string,
 *   library: string,
 *   task: string,
 *   extractionOptions: { pooling: string, normalize: boolean },
 *   inputPrefix: string,
 *   batchSize: number,
 * }>}
 */
export const encoderConfigs = {
  /**
   * Jinaai/jina-embeddings-v2-base-de  –  768-dim, Deutsch-only.
   * Paper: arXiv:2402.17016 (Jina AI, Berlin).
   * Standard-Encoder für rein deutschsprachige Trainingsdaten.
   */
  [EncoderName.JINA_DE]: {
    name: "jina-de",
    modelName: "jinaai/jina-embeddings-v2-base-de",
    library: "@huggingface/transformers",
    task: "feature-extraction",
    extractionOptions: { pooling: "mean", normalize: true },
    inputPrefix: "",      // Kein Prefix nötig
    batchSize: 16
  },

  /**
   * Xenova/multilingual-e5-large  –  1024-dim, 100+ Sprachen.
   * Paper: arXiv:2402.05672 (Microsoft Research).
   * Für gemischte DE+EN Trainingsdaten geeignet.
   * Pflicht-Prefix "query: " laut Modell-Card (symmetrische Klassifikation).
   */
  [EncoderName.E5_LARGE]: {
    name: "e5-large",
    modelName: "Xenova/multilingual-e5-large",
    library: "@huggingface/transformers",
    task: "feature-extraction",
    extractionOptions: { pooling: "mean", normalize: true },
    inputPrefix: "query: ",
    batchSize: 8       // 560M Parameter – weniger RAM als jina-de
  },

  /**
   * Xenova/bge-m3  –  1024-dim, 100+ Sprachen.
   * Paper: arXiv:2402.03216 (BAAI, Peking).
   * State-of-the-art multilingual; kein Instruction-Prefix für symmetrische Tasks.
   */
  [EncoderName.BGE_M3]: {
    name: "bge-m3",
    modelName: "Xenova/bge-m3",
    library: "@huggingface/transformers",
    task: "feature-extraction",
    extractionOptions: { pooling: "mean", normalize: true },
    inputPrefix: "",      // Kein Prefix für symmetrische Klassifikation
    batchSize: 8
  }
};
