// Este archivo forma parte del motor de recomendaciones y me ayuda a comparar perfiles de usuario con un criterio más claro.

// Esta función me sirve para ver si dos personas tienen gustos parecidos.
// Si una persona ha marcado cosas similares, eso puede ser una pista muy útil para la otra.
export function calculateCosineSimilarity(vecA: Map<number, number>, vecB: Map<number, number>): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (const [key, valueA] of vecA.entries()) {
    dotProduct += valueA * (vecB.get(key) || 0);
    normA += valueA * valueA;
  }

  for (const valueB of vecB.values()) {
    normB += valueB * valueB;
  }

  if (normA === 0 || normB === 0) {
    return 0; // Prevent division by zero
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
