/**
 * Erkennt near-duplicate "Diensttyp-Vorlagen" ueber Shingling und den Jaccard-
 * Koeffizienten (Manning/Raghavan/Schuetze, "Introduction to Information Retrieval",
 * Abschn. 19.6 "Near-duplicates and shingling", S. 437-440): Texte werden in
 * k-Gramm-Mengen ("Shingles") zerlegt, paarweise ueber den Jaccard-Koeffizienten
 * verglichen und bei Ueberschreiten eines Schwellenwerts per Union-Find zu
 * "syntaktischen Clustern" zusammengefasst (ebd., S. 439).
 */
export class NearDuplicateDetector {
  /**
   * Gruppiert Anforderungen in near-duplicate Cluster.
   * Unverknuepfte Anforderungen bilden ein Cluster mit sich selbst.
   *
   * @param {import("../models/Requirement.js").Requirement[]} requirements
   * @param {object} [options]
   * @param {number} [options.k=3]            Shingle-Laenge in Termen.
   * @param {number} [options.threshold=0.45] Jaccard-Schwellenwert fuer Near-Duplicates.
   * @returns {Map<string, import("../models/Requirement.js").Requirement[]>} ID -> ID-sortierte Clustermitglieder.
   */
  detectClusters(requirements, { k = 3, threshold = 0.45 } = {}) {
    const shingles = new Map(requirements.map(req => [req.id, this.#shingles(req.text, k)]));
    const parent = new Map(requirements.map(req => [req.id, req.id]));
    const find = id => (parent.get(id) === id ? id : find(parent.get(id)));

    for (let i = 0; i < requirements.length; i++) {
      for (let j = i + 1; j < requirements.length; j++) {
        const a = requirements[i].id;
        const b = requirements[j].id;
        if (find(a) === find(b)) continue;
        if (this.#jaccard(shingles.get(a), shingles.get(b)) >= threshold) parent.set(find(a), find(b));
      }
    }

    const clusters = new Map();
    for (const members of Map.groupBy(requirements, req => find(req.id)).values()) {
      const sorted = members.toSorted((a, b) => a.id.localeCompare(b.id));
      for (const member of sorted) clusters.set(member.id, sorted);
    }
    return clusters;
  }

  /**
   * Bildet die Menge der k-Shingles eines Textes: alle aufeinanderfolgenden
   * Wortfolgen der Laenge k (Manning, S. 438).
   * @param text
   * @param k
   */
  #shingles(text, k) {
    const terms = text.toLowerCase().replace(/[„"().,;:/-]/g, " ").split(/\s+/).filter(Boolean);
    const shingles = new Set();
    for (let i = 0; i <= terms.length - k; i++) shingles.add(terms.slice(i, i + k).join(" "));
    return shingles.size ? shingles : new Set([terms.join(" ")]);
  }

  /**
   * Jaccard-Koeffizient zweier Shingle-Mengen: |Schnittmenge| / |Vereinigung|
   * (Manning, S. 438, im Anschluss an die Definition auf S. 61).
   * @param a
   * @param b
   */
  #jaccard(a, b) {
    let intersection = 0;
    for (const shingle of a) if (b.has(shingle)) intersection++;
    const union = a.size + b.size - intersection;
    return union ? intersection / union : 0;
  }
}
