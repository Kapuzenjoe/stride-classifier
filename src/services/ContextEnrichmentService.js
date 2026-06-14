import { Requirement } from "../models/Requirement.js";

/**
 * Reichert Anforderungen mit ihren verknuepften Kontextelementen an.
 * Kontextelemente werden dem Anforderungstext als Suffix angehängt.
 */
export class ContextEnrichmentService {
  /**
   * Gibt eine neue Anforderungsliste zurueck, in der jede Anforderung
   * mit dem Text ihrer verknuepften Kontextelemente angereichert ist.
   *
   * @param {import("../models/Requirement.js").Requirement[]} requirements
   * @param {import("../models/RequirementContainer.js").RequirementContainer} container
   * @returns {import("../models/Requirement.js").Requirement[]}
   */
  enrich(requirements, container) {
    const elementById = new Map(
      container.contextElements.map(el => [el.id, el])
    );

    const relsByRequirementId = Map.groupBy(container.relations, rel => rel.fromId);

    return requirements.map(req => {
      const rels = relsByRequirementId.get(req.id) ?? [];
      if (rels.length === 0) return req;

      const contextSuffix = rels
        .map(rel => elementById.get(rel.toId))
        .filter(Boolean)
        .map(el => `${el.designation}: ${el.content.description}`)
        .join(" | ");

      return new Requirement({
        id: req.id,
        text: `${req.text} | ${contextSuffix}`,
        containerId: req.containerId
      });
    });
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
