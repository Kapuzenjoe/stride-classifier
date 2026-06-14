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
   */
  constructor({ id, name = "", requirements = [], contextElements = [], relations = [] }) {
    this.id = id;
    this.name = name;
    this.requirements = requirements;
    this.contextElements = contextElements;
    this.relations = relations;
  }
}
