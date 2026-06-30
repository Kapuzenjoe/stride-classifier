import seedrandom from "seedrandom";
import { STRIDE_CODES } from "../models/StrideCategory.js";
import { NearDuplicateDetector } from "./NearDuplicateDetector.js";

/**
 * Stellt stratifizierte Splits fuer Multi-Label-Daten bereit.
 * Stratifikation erfolgt ueber die Label-Signatur (Binaerstring je Klasse, z. B. "110001"),
 * sodass die Klassenverteilung in jedem Split erhalten bleibt..
 */
export class EvaluationService {
  #detector = new NearDuplicateDetector();

  /**
   * Teilt Anforderungen stratifiziert in Trainings-, Validierungs- und Testmenge auf.
   * Standardaufteilung: 70 % Training, 15 % Validierung, 15 % Test.
   *
   * @param {import("../models/Requirement.js").Requirement[]} requirements
   * @param {Map<string, object>} labelMap
   * @param {object} [options]
   * @param {number} [options.trainRatio=0.70]  Anteil der Trainingsmenge.
   * @param {number} [options.valRatio=0.15]    Anteil der Validierungsmenge.
   * @param {number} [options.seed=42]          Seed fuer die Zufallsmischung je Signaturgruppe.
   * @returns {{
   *   train:      import("../models/Requirement.js").Requirement[],
   *   validation: import("../models/Requirement.js").Requirement[],
   *   test:       import("../models/Requirement.js").Requirement[]
   * }}
   */
  splitTrainValTest(requirements, labelMap, { trainRatio = 0.70, valRatio = 0.15, seed = 42 } = {}) {
    const sorted = requirements.toSorted((a, b) => a.id.localeCompare(b.id));

    const clusters = this.#detector.detectClusters(sorted);
    const representatives = sorted.filter(req => clusters.get(req.id)[0] === req);
    const groups = this.#groupBySignature(representatives, labelMap);

    const train = []; const validation = []; const test = [];
    const assign = (target, reps) => target.push(...reps.flatMap(rep => clusters.get(rep.id)));

    for (const [i, group] of [...groups.values()].entries()) {
      const shuffled = this.#shuffle(group, seed + i);
      const nTrain = Math.round(shuffled.length * trainRatio);
      const nVal = Math.round(shuffled.length * valRatio);
      assign(train, shuffled.slice(0, nTrain));
      assign(validation, shuffled.slice(nTrain, nTrain + nVal));
      assign(test, shuffled.slice(nTrain + nVal));
    }

    return { train, validation, test };
  }

  /**
   * Gruppiert Anforderungen nach ihrer Label-Signatur fuer die Stratifikation.
   * Signatur: Binaerstring der STRIDE_CODES-Reihenfolge, z. B. "110001".
   *
   * @param {import("../models/Requirement.js").Requirement[]} requirements
   * @param {Map<string, object>} labelMap
   * @returns {Map<string, import("../models/Requirement.js").Requirement[]>}
   */
  #groupBySignature(requirements, labelMap) {
    return Map.groupBy(requirements, req => {
      const labels = labelMap.get(req.id);
      return STRIDE_CODES.map(c => (labels?.[c] ? "1" : "0")).join("");
    });
  }

  /**
   * Fisher-Yates-Shuffle mit seedrandom-Zufallsgenerator.
   * Deterministisch fuer gleichen seed; erzeugt eine neue Kopie des Arrays.
   *
   * @param {unknown[]} arr   Eingabe-Array (wird nicht veraendert).
   * @param {number}    seed  Seed-Wert.
   * @returns {unknown[]}     Gemischte Kopie.
   */
  #shuffle(arr, seed) {
    const rng = seedrandom(String(seed));
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}
