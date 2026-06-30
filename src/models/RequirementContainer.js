/**
 * Bündelt Anforderungen mit zugehörigen Kontextelementen und Relationen.
 */
export class RequirementContainer {
  /**
   * @param {object} data
   * @param {string} data.id Eindeutige ID des Containers.
   * @param {string} [data.name] Optionaler Name des Containers.
   * @param {import("./Requirement.js").Requirement[]} [data.requirements]
   * @param {import("./ContextElement.js").ContextElement[]} [data.contextElements]
   * @param {import("./Relation.js").Relation[]} [data.relations]
   * @param {boolean} [data.withContext] Kontextelemente per Vektor-Fusion einbeziehen?
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
