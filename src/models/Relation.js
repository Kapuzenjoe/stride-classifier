/**
 * Relation – verbindet eine Anforderung mit einem anderen Objekt (Anforderung oder Kontextelement).
 */
export class Relation {
  /**
   * @param {object} data Relationsdaten.
   * @param {string} data.id Eindeutige ID der Relation.
   * @param {string} data.type Relationstyp (z. B. "hasSource", "refines", "conflicts").
   * @param {string} data.fromId ID des Ausgangsobjekts (i. d. R. Anforderung).
   * @param {string} data.toId ID des Zielobjekts (Anforderung oder Kontextelement).
   */
  constructor({ id, type, fromId, toId }) {
    this.id = id;
    this.type = type;
    this.fromId = fromId;
    this.toId = toId;
  }
}
