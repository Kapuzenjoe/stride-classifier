/**
 * Einzelne Anforderung mit optionalem Containerbezug.
 */
export class Requirement {
  /**
   * @param {object} data
   * @param {string} data.id Eindeutige ID der Anforderung.
   * @param {string} data.text Natürlichsprachlicher Anforderungstext; Grundlage für die Einbettungsberechnung.
   * @param {string|null} [data.containerId] Optionaler Bezug zum übergeordneten Anforderungscontainer.
   */
  constructor({ id, text, containerId = null }) {
    this.id = id;
    this.text = text;
    this.containerId = containerId;
  }
}
