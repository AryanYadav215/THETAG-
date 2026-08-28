// Hardcoded Stopword list to filter out high-frequency, low-meaning words
const STOPWORDS = new Set([
  'i','me','my','myself','we','our','ours','ourselves','you','your','yours',
  'yourself','yourselves','he','him','his','himself','she','her','hers',
  'herself','it','its','itself','they','them','their','theirs','themselves',
  'what','which','who','whom','this','that','these','those','am','is','are',
  'was','were','be','been','being','have','has','had','having','do','does',
  'did','doing','a','an','the','and','but','if','or','because','as','until',
  'while','of','at','by','for','with','about','against','between','into',
  'through','during','before','after','above','below','to','from','up','down',
  'in','out','on','off','over','under','again','further','then','once','here',
  'there','when','where','why','how','all','both','each','few','more','most',
  'other','some','such','no','nor','not','only','own','same','so','than',
  'too','very','s','t','can','will','just','don','should','now','d','ll',
  'm','o','re','ve','y','ain','aren','couldn','didn','doesn','hadn','hasn',
  'haven','isn','ma','mightn','mustn','needn','shan','shouldn','wasn',
  'weren','won','wouldn','also','would','could','like','get','got','use',
  'used','one','two','three','make','made','know','think','want','need',
  'way','well','even','back','thing','things','really','actually','basically',
  'something','anything','everything','nothing','someone','anyone','everyone',
  'maybe','might','much','many','let','see','say','said','okay','yes',
  'please','thank','thanks','sure','right','hi','hey','hello'
]);

// Simplified Porter Stemmer rules applied in order
const STEMMER_RULES = [
  { suffix: 'ational', replacement: 'ate' },
  { suffix: 'tional',  replacement: 'tion' },
  { suffix: 'enci',    replacement: 'ence' },
  { suffix: 'anci',    replacement: 'ance' },
  { suffix: 'izer',    replacement: 'ize' },
  { suffix: 'ising',   replacement: 'ise' },
  { suffix: 'izing',   replacement: 'ize' },
  { suffix: 'ation',   replacement: 'ate' },
  { suffix: 'ations',  replacement: 'ate' },
  { suffix: 'alism',   replacement: 'al' },
  { suffix: 'ness',    replacement: '' },
  { suffix: 'ment',    replacement: '' },
  { suffix: 'ments',   replacement: '' },
  { suffix: 'ings',    replacement: '' },
  { suffix: 'ing',     replacement: '' },
  { suffix: 'tion',    replacement: 'te' },
  { suffix: 'tions',   replacement: 'te' },
  { suffix: 'ies',     replacement: 'y' },
  { suffix: 'ied',     replacement: 'y' },
  { suffix: 'ful',     replacement: '' },
  { suffix: 'less',    replacement: '' },
  { suffix: 'ly',      replacement: '' },
  { suffix: 'er',      replacement: '' },
  { suffix: 'ed',      replacement: '' },
  { suffix: 'es',      replacement: '' },
  { suffix: 's',       replacement: '' }
];

function stem(word) {
  if (word.length < 4) return word; // don't stem short words
  for (const rule of STEMMER_RULES) {
    if (word.endsWith(rule.suffix)) {
      const stemmed = word.slice(0, word.length - rule.suffix.length) + rule.replacement;
      if (stemmed.length >= 3) return stemmed; // don't over-stem
    }
  }
  return word;
}

function tokenize(text) {
  if (!text) return [];

  let processedText = text.toLowerCase();

  // Handle multi-line code blocks: Extract technical terms by replacing non-alphanumeric chars inside backticks with spaces
  processedText = processedText.replace(/```[\s\S]*?```/g, (match) => {
    return match.replace(/[^a-z0-9\s]/g, ' ');
  });
  
  // Handle inline code snippets similarly
  processedText = processedText.replace(/`([^`]+)`/g, (match) => {
    return match.replace(/[^a-z0-9\s]/g, ' ');
  });

  // Remove URLs
  processedText = processedText.replace(/https?:\/\/[^\s]+/g, '');

  // Remove all remaining punctuation — keep only letters, numbers, spaces
  processedText = processedText.replace(/[^a-z0-9\s]/g, ' ');

  // Split on whitespace into raw tokens
  let tokens = processedText.split(/\s+/).filter(Boolean);

  // Performance cap: process only the first 500 words per message
  if (tokens.length > 500) {
    tokens = tokens.slice(0, 500);
  }

  const finalTokens = [];
  
  // Filter stopwords, apply stemmer, and enforce minimum character length
  for (const token of tokens) {
    if (!STOPWORDS.has(token)) {
      const stemmedToken = stem(token);
      if (stemmedToken.length >= 3) { // Ensure tokens are at least 3 characters after stemming
        finalTokens.push(stemmedToken);
      }
    }
  }

  return finalTokens;
}