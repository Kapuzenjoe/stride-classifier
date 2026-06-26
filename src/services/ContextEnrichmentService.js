/**
 * Reichert Anforderungen mit ihren verknuepften Kontextelementen an.
 * Kontextelemente werden dem Anforderungstext als Suffix angehängt.
 */
export class ContextEnrichmentService {
  /**
   * Gibt je Anforderung die verknuepften Kontextelemente zurueck.
   *
   * @param {import("../models/Requirement.js").Requirement[]} requirements
   * @param {import("../models/RequirementContainer.js").RequirementContainer} container
   * @returns {Map<string, import("../models/ContextElement.js").ContextElement[]>}
   */
  linkedContext(requirements, container) {
    const elementById = new Map(container.contextElements.map(el => [el.id, el]));
    const relsByRequirementId = Map.groupBy(container.relations, rel => rel.fromId);

    return new Map(requirements.map(req => [
      req.id,
      (relsByRequirementId.get(req.id) ?? []).map(rel => elementById.get(rel.toId)).filter(Boolean)
    ]));
  }

  /**
   * Gibt die Anzahl der Anforderungen zurueck, die mindestens ein verknuepftes Kontextelement haben,
   * sowie die Gesamtzahl der Anforderungen.
   *
   * @param {import("../models/Requirement.js").Requirement[]} requirements
   * @param {import("../models/RequirementContainer.js").RequirementContainer} container
   * @returns {{ enriched: number, total: number }}
   */
  coverage(requirements, container) {
    const reqIds = new Set(requirements.map(r => r.id));
    const linkedIds = new Set(
      container.relations
        .filter(rel => reqIds.has(rel.fromId))
        .map(rel => rel.fromId)
    );
    return { enriched: linkedIds.size, total: requirements.length };
  }
}
