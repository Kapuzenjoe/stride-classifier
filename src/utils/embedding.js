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
 * Berechnet den L2-normierten Mittelwert einer Menge von Einbettungen.
 *
 * @param {Array<Float32Array|number[]>} embeddings  Einbettungen der positiven Trainingsbeispiele.
 * @returns {number[]}  L2-normierter Centroid-Vektor.
 */
export function normalizedMean(embeddings) {
  const mean = new Matrix(embeddings.map(e => Array.from(e))).mean("column");
  const norm = Math.sqrt(mean.reduce((s, v) => s + v * v, 0));
  return norm > 0 ? mean.map(v => v / norm) : mean;
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
