/**
 * Assembles the detected boundaries into logical chunk objects for the UI.
 */
function buildChunks(messages, tfidfResults, boundaries) {
  const chunks = [];

  for (let i = 0; i < boundaries.length - 1; i++) {
    const start = boundaries[i];
    const end = boundaries[i + 1];

    const chunkMessages = messages.slice(start, end);
    const chunkTFIDF = tfidfResults.slice(start, end);

    // Aggregate all TF-IDF scores across the entire chunk to find the true topic
    const aggregated = {};
    chunkTFIDF.forEach(({ scores }) => {
      Object.entries(scores).forEach(([word, score]) => {
        aggregated[word] = (aggregated[word] || 0) + score;
      });
    });

    // Extract the Top 3 words, capitalize them, and format as the Topic Title
    const topWords = Object.entries(aggregated)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([word]) => word.charAt(0).toUpperCase() + word.slice(1));

    const topicName = topWords.length > 0 ? topWords.join(' · ') : 'General Discussion';

    // Extract the Top 8 words to display as tag pills in the UI
    const keywords = Object.entries(aggregated)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([word]) => word);

    chunks.push({
      id: i,
      topicName,
      keywords,
      messageCount: chunkMessages.length,
      startIndex: start,
      endIndex: end,
      messages: chunkMessages // Full message text stored for the click-to-view UI
    });
  }

  // Clean up the output by eliminating micro-chunks
  return mergeSmallChunks(chunks);
}

/**
 * Merges chunks that are too small (less than 2 messages) into the adjacent chunk.
 * This prevents UI clutter from single-message responses like "Okay" or "Thanks".
 */
function mergeSmallChunks(chunks, minSize = 2) {
  const result = [];
  
  for (let i = 0; i < chunks.length; i++) {
    if (chunks[i].messageCount < minSize && result.length > 0) {
      // Merge into the previous chunk
      const prev = result[result.length - 1];
      
      // Combine message arrays and update counts
      prev.messages = [...prev.messages, ...chunks[i].messages];
      prev.messageCount = prev.messages.length;
      prev.endIndex = chunks[i].endIndex;
      
      // Recombine and deduplicate the keyword tags, capping it back at 8
      prev.keywords = [...new Set([...prev.keywords, ...chunks[i].keywords])].slice(0, 8);
    } else {
      result.push({ ...chunks[i] });
    }
  }
  
  return result;
}