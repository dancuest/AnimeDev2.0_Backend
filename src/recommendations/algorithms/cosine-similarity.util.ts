// Este archivo forma parte del motor de recomendaciones. Aquí se define cómo se interpreta el comportamiento del usuario para sugerir contenido más útil.

// Esta función me ayuda a comparar perfiles de usuario.
// Si dos personas tienen intereses parecidos, las elecciones de una pueden servir como pista para la otra.
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
