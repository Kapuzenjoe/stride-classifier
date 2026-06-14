/**
 * Kontextelement - ergaenzt eine oder mehrere Anforderungen mit Hintergrundinformationen.
 */
export class ContextElement {
  /**
   * @param {object} data Kontextelementdaten.
   * @param {string} data.id Eindeutige ID des Kontextelements.
   * @param {string} data.designation Bezeichnung des Kontextelements.
   * @param {string} data.type Typ des Kontextelements (z. B. "source", "stakeholder", "glossary").
   * @param {object} [data.content] Optionaler Inhalt des Kontextelements.
   */
  constructor({ id, designation, type, content = {} }) {
    this.id = id;
    this.designation = designation;
    this.type = type;
    this.content = content;
  }
}
