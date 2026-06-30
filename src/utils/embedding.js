import { Matrix } from "ml-matrix";

/**
 * Skalarprodukt zweier L2-normierter Vektoren (= Cosine-Aehnlichkeit).
 *
 * @param {Float32Array|number[]} a
 * @param {Float32Array|number[]} b
 * @returns {number} Wert in [-1, 1].
 */
export function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/**
 * L2-normiert einen Vektor (Einheitslaenge).
 *
 * @param {number[]} vector
 * @returns {number[]}
 */
function l2Normalize(vector) {
  const norm = Math.sqrt(vector.reduce((s, v) => s + (v * v), 0));
  return norm > 0 ? vector.map(v => v / norm) : vector;
}

/**
 * Berechnet den L2-normierten Mittelwert einer Menge von Einbettungen.
 *
 * @param {Array<Float32Array|number[]>} embeddings  Einbettungen der positiven Trainingsbeispiele.
 * @returns {number[]}  L2-normierter Centroid-Vektor.
 */
export function normalizedMean(embeddings) {
  const mean = new Matrix(embeddings.map(e => Array.from(e))).mean("column");
  return l2Normalize(mean);
}

/**
 * Berechnet den Sigmoid-Zuordnungswert σ(W·embedding + b) einer linearen Hypothese.
 *
 * @param {Float32Array|number[]} embedding   L2-normalisierte Einbettung der Anforderung.
 * @param {{ W: number[], b: number }} weights Gewichtsvektor und Bias der Hypothese.
 * @returns {number}  Zuordnungswert ∈ (0, 1).
 */
export function linearScore(embedding, { W, b }) {
  let d = b;
  for (let j = 0; j < W.length; j++) d += W[j] * embedding[j];
  return 1 / (1 + Math.exp(-d));
}

/**
 * Indizes der k aehnlichsten Eintraege (absteigend nach Similarity-Wert).
 *
 * @param {number[]} sims  Similarity-Werte zu allen Trainingsbeispielen.
 * @param {number}   k     Anzahl der Nachbarn.
 * @returns {number[]}
 */
export function topKIndices(sims, k) {
  return sims
    .map((s, i) => ({ s, i }))
    .sort((a, b) => b.s - a.s)
    .slice(0, k)
    .map(x => x.i);
}

/**
 * Relativiert klassenweise Aehnlichkeitswerte gegen ihren Durchschnitt ueber alle Klassen.
 *
 * @param {Record<string, number>} scores  Rohe Aehnlichkeitswerte je Klasse.
 * @returns {Record<string, number>}        Werte minus Durchschnitt ueber alle Klassen.
 */
export function centerScores(scores) {
  const values = Object.values(scores);
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  return Object.fromEntries(Object.entries(scores).map(([code, v]) => [code, v - mean]));
}

/**
 * Kombiniert eine Anforderungseinbettung mit dem Mittelwert verknuepfter Kontexteinbettungen
 * und normiert das Ergebnis erneut auf Einheitslaenge. Ohne Kontext bleibt die Einbettung unveraendert.
 *
 * @param {Float32Array|number[]} reqEmbedding
 * @param {Array<Float32Array|number[]>} ctxEmbeddings
 * @param {number} [alpha=0.7]  Gewicht der Anforderung; Kontextanteil ist (1 - alpha).
 * @returns {number[]}
 */
export function fuseEmbedding(reqEmbedding, ctxEmbeddings, alpha = 0.7) {
  if (ctxEmbeddings.length === 0) return Array.from(reqEmbedding);
  const ctxMean = new Matrix(ctxEmbeddings.map(e => Array.from(e))).mean("column");
  const fused = ctxMean.map((v, i) => (alpha * reqEmbedding[i]) + ((1 - alpha) * v));
  return l2Normalize(fused);
}
