/**
 * Bündelt Anforderungen mit zugehörigen Kontextelementen und Relationen.
 */
export class RequirementContainer {
  /**
   * @param {object} data
   * @param {string} data.id Eindeutige ID des Containers.
   * @param {string} [data.name] Optionaler Name des Containers.
   * @param {import("./Requirement.js").Requirement[]} [data.requirements] Enthaltene Anforderungen.
   * @param {import("./ContextElement.js").ContextElement[]} [data.contextElements] Kontextelemente des Containers.
   * @param {import("./Relation.js").Relation[]} [data.relations] Relationen zwischen Anforderungen und Kontextelementen.
   * @param {boolean} [data.withContext] Ob Kontextelemente per Vektor-Fusion einbezogen werden sollen.
   */
  constructor({ id, name = "", requirements = [], contextElements = [], relations = [], withContext = false }) {
    this.id = id;
    this.name = name;
    this.requirements = requirements;
    this.contextElements = contextElements;
    this.relations = relations;
    this.withContext = withContext;
  }
}
