function computeTF(tokens) {
  const freq = {};
  
  // Count raw occurrences of each word in the message
  tokens.forEach(t => { 
    freq[t] = (freq[t] || 0) + 1; 
  });
  
  const total = tokens.length;
  const tf = {};
  
  // Divide by total words in the message to normalize the score (Term Frequency)
  if (total > 0) {
    Object.keys(freq).forEach(t => { 
      tf[t] = freq[t] / total; 
    });
  }
  
  return tf;
}

function computeIDF(allTokenArrays) {
  const N = allTokenArrays.length;
  const docFreq = {};

  // Count how many total messages contain each specific word
  allTokenArrays.forEach(tokens => {
    const unique = new Set(tokens);
    unique.forEach(t => { 
      docFreq[t] = (docFreq[t] || 0) + 1; 
    });
  });

  const idf = {};
  
  // Calculate the Inverse Document Frequency using logarithmic scaling.
  // Words appearing in every message approach a score of 0.
  Object.keys(docFreq).forEach(t => {
    idf[t] = Math.log(N / docFreq[t]);
  });
  
  return idf;
}

function computeTFIDF(tokenizedMessages) {
  const idf = computeIDF(tokenizedMessages);

  return tokenizedMessages.map((tokens, idx) => {
    const tf = computeTF(tokens);
    const scores = {};

    // Multiply the local importance (TF) by the global rarity (IDF)
    Object.keys(tf).forEach(t => {
      scores[t] = tf[t] * (idf[t] || 0);
    });

    // Extract the top 5 highest-scoring words to represent this specific message
    const topKeywords = Object.entries(scores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);

    return { 
      messageIndex: idx, 
      topKeywords, 
      scores 
    };
  });
}