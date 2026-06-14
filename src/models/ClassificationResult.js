/**
 * Ergebnis eines Klassifikations- oder Inferenzlaufs für eine einzelne Anforderung.
 */
export class ClassificationResult {
  /**
   * @param {object} data
   * @param {string} data.requirementId ID der klassifizierten Anforderung.
   * @param {string|null} [data.containerId] Zugehöriger Anforderungscontainer.
   * @param {string[]} [data.labels] Zugeordnete STRIDE-Klassen (Teilmenge von S/T/R/I/D/E).
   * @param {Record<string,number>} [data.scores] Zuordnungswert je STRIDE-Klasse.
   * @param {object} data.classifier Kenndaten des verwendeten Klassifikators.
   */
  constructor({ requirementId, containerId = null, labels = [], scores = {}, classifier }) {
    this.requirementId = requirementId;
    this.containerId = containerId;
    this.labels = labels;
    this.scores = scores;
    this.classifier = classifier;
  }
}
