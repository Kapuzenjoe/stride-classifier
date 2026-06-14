import { ClassifierPlugin } from "../ClassifierPlugin.js";
import { ClassificationResult } from "../../models/ClassificationResult.js";
import { ruleBasedConfig } from "./ruleBased.config.js";

/**
 * Regelbasierter Baseline-Klassifikator.
 * Weist STRIDE-Labels anhand von Schluesselwort-Treffern zu (Binary Relevance).
 * Entscheidungsregel: y_l = 1 wenn mindestens ein Schluesselwort aus W_l als Teilstring vorkommt.
 */
export class RuleBasedClassifierPlugin extends ClassifierPlugin {
  /**
   * Initialisiert den regelbasierten Klassifikator und berechnet die
   * Schluesselwoerter je STRIDE-Klasse einmalig in Lowercase vor.
   */
  constructor() {
    super({
      name: ruleBasedConfig.name,
      method: ruleBasedConfig.method
    });

    this.config = ruleBasedConfig;

    this.keywordsLower = Object.fromEntries(
      Object.entries(ruleBasedConfig.keywords).map(([category, kws]) => [
        category,
        kws.map(kw => kw.toLowerCase())
      ])
    );
  }

  /**
   * Klassifiziert Anforderungen per Schluesselwort-Matching.
   *
   * @param {import("../../models/Requirement.js").Requirement[]} requirements
   * @returns {Promise<ClassificationResult[]>}
   */
  async classify(requirements) {
    return requirements.map(requirement =>
      this.#classifySingle(requirement)
    );
  }

  /**
   * Weist einer einzelnen Anforderung STRIDE-Labels per Teilstring-Matching zu.
   * Ein Label wird gesetzt, wenn mindestens ein Schluesselwort aus W_l im Text vorkommt.
   *
   * @param {import("../../models/Requirement.js").Requirement} requirement
   * @returns {ClassificationResult}
   */
  #classifySingle(requirement) {
    const textLower = requirement.text.toLowerCase();
    const labels = [];

    for (const [category, keywords] of Object.entries(this.keywordsLower)) {
      if (keywords.some(kw => textLower.includes(kw))) labels.push(category);
    }

    return new ClassificationResult({
      requirementId: requirement.id,
      containerId: requirement.containerId,
      labels,
      scores: {},
      classifier: {
        name: this.name,
        method: this.method
      }
    });
  }
}
