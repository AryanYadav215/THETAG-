/**
 * Calculates the Jaccard Similarity between two arrays of keywords.
 * Formula: (Intersection / Union)
 * A score of 1 means identical sets; 0 means completely completely different.
 */
function jaccard(setA, setB) {
  const a = new Set(setA);
  const b = new Set(setB);
  
  // Find words that exist in both sets
  const intersection = [...a].filter(x => b.has(x)).length;
  
  // Find the total number of unique words across both sets
  const union = new Set([...a, ...b]).size;
  
  return union === 0 ? 1 : intersection / union;
}

/**
 * Sweeps a sliding window across the conversation to find where the topic vocabulary drastically changes.
 */
function detectBoundaries(tfidfResults, windowSize = 3, threshold = 0.25) {
  const boundaries = [0]; // The conversation always starts a new topic at index 0
  const n = tfidfResults.length;

  for (let i = windowSize; i < n - windowSize; i++) {
    // Collect all top keywords from the window BEFORE the current position
    const beforeKeywords = tfidfResults
      .slice(Math.max(0, i - windowSize), i)
      .flatMap(r => r.topKeywords);

    // Collect all top keywords from the window AFTER the current position
    const afterKeywords = tfidfResults
      .slice(i, Math.min(n, i + windowSize))
      .flatMap(r => r.topKeywords);

    // Calculate how similar the two windows are
    const similarity = jaccard(beforeKeywords, afterKeywords);

    // If similarity drops below 0.25, the vocabulary has shifted enough to call it a new topic
    if (similarity < threshold) {
      // Prevent creating multiple boundaries for a single transition (minimum gap: windowSize)
      const lastBoundary = boundaries[boundaries.length - 1];
      if (i - lastBoundary >= windowSize) {
        boundaries.push(i);
      }
    }
  }

  boundaries.push(n); // Cap it off at the very end of the conversation array
  return boundaries;
}