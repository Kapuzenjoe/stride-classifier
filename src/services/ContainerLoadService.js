import { readFile } from "node:fs/promises";
import { RequirementContainer } from "../models/RequirementContainer.js";
import { Requirement } from "../models/Requirement.js";
import { ContextElement } from "../models/ContextElement.js";
import { Relation } from "../models/Relation.js";

/**
 * Laedt einen persistierten RequirementContainer aus einer JSON-Datei und deserialisiert ihn in Modell-Objekte.
 */
export class ContainerLoadService {
  /**
   * Laedt und hydratisiert einen Container aus einer JSON-Datei.
   *
   * @param {string} filePath Absoluter Pfad zur Container-JSON-Datei.
   * @returns {Promise<{
   *   container: RequirementContainer,
   *   labelMap: Map<string, {S: boolean, T: boolean, R: boolean, I: boolean, D: boolean, E: boolean}>
   * }>}
   */
  async load(filePath) {
    let raw;
    try {
      raw = JSON.parse(await readFile(filePath, "utf-8"));
    } catch(err) {
      throw new Error(`Container nicht lesbar: "${filePath}" – ${err.message}`);
    }
    raw.contextElements ??= [];
    raw.relations ??= [];

    const labelMap = new Map();

    const requirements = raw.requirements.map(r => {
      if (r.labels !== null) {
        labelMap.set(r.id, r.labels);
      }

      return new Requirement({
        id: r.id,
        text: r.text,
        containerId: r.containerId
      });
    });

    const contextElements = raw.contextElements.map(
      c => new ContextElement({ id: c.id, designation: c.designation, type: c.type, content: c.content })
    );

    const relations = raw.relations.map(
      rel => new Relation({ id: rel.id, type: rel.type, fromId: rel.fromId, toId: rel.toId })
    );

    const container = new RequirementContainer({
      id: raw.id,
      name: raw.name,
      requirements,
      contextElements,
      relations
    });

    return { container, labelMap };
  }

}
