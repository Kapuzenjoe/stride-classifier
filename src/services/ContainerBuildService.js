import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { RequirementContainer } from "../models/RequirementContainer.js";

/**
 * Baut einen persistenten RequirementContainer und schreibt ihn als JSON-Datei.
 */
export class ContainerBuildService {
  /**
   * @param {object} datasetConfig Pfade aus datasets.config.js.
   */
  constructor(datasetConfig) {
    this.datasetConfig = datasetConfig;
  }

  /**
   * Baut einen RequirementContainer und persistiert ihn als JSON.
   *
   * @param {object} options
   * @param {string} options.containerId        ID des Containers.
   * @param {string} options.containerName      Lesbare Bezeichnung des Containers.
   * @param {import("../models/Requirement.js").Requirement[]} options.requirements
   * @param {Map<string, object>} options.labelMap
   * @param {string} options.outputFileName     Dateiname der JSON-Ausgabe (ohne Pfad).
   * @param {import("../models/ContextElement.js").ContextElement[]} options.contextElements
   * @param {import("../models/Relation.js").Relation[]} options.relations
   * @returns {Promise<{ container: RequirementContainer, outputPath: string }>}
   */
  async build({ containerId, containerName, requirements, labelMap, outputFileName, contextElements, relations }) {
    const container = new RequirementContainer({
      id: containerId,
      name: containerName,
      requirements,
      contextElements,
      relations
    });

    const outputPath = path.join(this.datasetConfig.containerOutputDir, outputFileName);
    await mkdir(this.datasetConfig.containerOutputDir, { recursive: true });
    await writeFile(outputPath, JSON.stringify(this.#serialize(container, labelMap), null, 2), "utf-8");

    return { container, outputPath };
  }

  /**
   * Serialisiert den Container inkl. LabelMap in ein JSON-freundliches Objekt.
   *
   * @param {RequirementContainer} container
   * @param {Map<string, object>} labelMap
   * @returns {object}
   */
  #serialize(container, labelMap) {
    return {
      id: container.id,
      name: container.name,
      requirements: container.requirements.map(r => ({
        id: r.id,
        text: r.text,
        containerId: container.id,
        labels: labelMap.get(r.id) ?? null
      })),
      contextElements: container.contextElements.map(c => ({
        id: c.id,
        designation: c.designation,
        type: c.type,
        content: c.content
      })),
      relations: container.relations.map(rel => ({
        id: rel.id,
        type: rel.type,
        fromId: rel.fromId,
        toId: rel.toId
      }))
    };
  }
}
