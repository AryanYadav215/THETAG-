document.addEventListener('DOMContentLoaded', async () => {
  const data = await chrome.storage.local.get(['sourceTabId', 'sourceTabUrl']);
  const sourceTabId = data.sourceTabId;
  const sourceTabUrl = data.sourceTabUrl;

  if (!sourceTabId) {
    showState('error', 'Could not identify source tab. Please try opening the extension again.');
    return;
  }

  updateStatusBar(sourceTabUrl);
  showState('empty');

  document.getElementById('analyze-btn').addEventListener('click', () => {
    runAnalysis(sourceTabId);
  });

  document.getElementById('try-again-btn').addEventListener('click', () => {
    runAnalysis(sourceTabId);
  });
});

function updateStatusBar(url, overrideText) {
  const bar = document.getElementById('status-bar');
  if (overrideText) {
    bar.textContent = overrideText;
    return;
  }
  
  if (url) {
    try {
      const hostname = new URL(url).hostname;
      bar.textContent = `Connected to ${hostname}`;
    } catch (e) {
      bar.textContent = 'Connected to AI Chat';
    }
  }
}

async function runAnalysis(tabId) {
  showState('loading', 'Reading chat history...');

  // Step 1: Scrape messages from content script
  let messages;
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: 'SCRAPE_MESSAGES' });
    if (!response) {
       throw new Error('Connection failed. Make sure you are on a supported AI site and refresh the page.');
    }
    if (!response.success) throw new Error(response.error);
    messages = response.messages;
  } catch (err) {
    showState('error', err.message);
    return;
  }

  if (messages.length < 4) {
    showState('error', 'Not enough messages to analyze. Have a longer conversation first.');
    return;
  }

  updateLoadingText('Running TF-IDF pipeline...');

  // Step 2: Tokenize all messages
  await yieldToUI();
  const tokenized = messages.map(m => tokenize(m.text));

  updateLoadingText('Scoring keywords...');

  // Step 3: TF-IDF calculation
  await yieldToUI();
  const tfidfResults = computeTFIDF(tokenized);

  updateLoadingText('Detecting topic boundaries...');

  // Step 4: Detect boundaries
  await yieldToUI();
  const boundaries = detectBoundaries(tfidfResults);

  // Step 5: Build chunks
  await yieldToUI();
  const chunks = buildChunks(messages, tfidfResults, boundaries);

  // Step 6: Store and render
  await chrome.storage.local.set({ lastChunks: chunks, lastMessageCount: messages.length });
  
  updateStatusBar(null, `Analysis complete · ${chunks.length} topics across ${messages.length} messages`);
  showState('results');
  renderTopicCards(chunks, messages.length);
}

function renderTopicCards(chunks, totalMessages) {
  const grid = document.getElementById('topics-grid');
  const summary = document.getElementById('topics-summary');

  summary.textContent = `${chunks.length} topics found across ${totalMessages} messages`;
  grid.innerHTML = '';

  chunks.forEach((chunk, idx) => {
    const card = document.createElement('div');
    card.className = 'topic-card';
    card.innerHTML = `
      <div class="topic-card-header">
        <span class="topic-icon">📌</span>
        <h3 class="topic-name">${escapeHTML(chunk.topicName)}</h3>
      </div>
      <div class="topic-message-count">${chunk.messageCount} messages</div>
      <div class="topic-keywords">
        ${chunk.keywords.map(k => `<span class="keyword-tag">${escapeHTML(k)}</span>`).join('')}
      </div>
      <button class="view-messages-btn" data-chunk-id="${idx}">
        View Messages →
      </button>
    `;
    card.querySelector('.view-messages-btn').addEventListener('click', () => {
      showMessageViewer(chunk);
    });
    grid.appendChild(card);
  });
}

function showMessageViewer(chunk) {
  showState('viewer');
  const heading = document.getElementById('viewer-heading');
  const list = document.getElementById('message-list');

  heading.textContent = chunk.topicName;
  list.innerHTML = '';

  chunk.messages.forEach(msg => {
    const item = document.createElement('div');
    const roleLower = msg.role.toLowerCase();
    item.className = `message-item message-item--${roleLower}`;
    
    // Total XSS Hygiene Applied
    item.innerHTML = `
      <span class="role-badge role-badge--${roleLower}">${escapeHTML(msg.role)}</span>
      <p class="message-text">${escapeHTML(msg.text)}</p>
    `;
    list.appendChild(item);
  });

  document.getElementById('back-btn').onclick = () => {
    showState('results');
  };
}

// State manager
function showState(state, message = '') {
  ['empty', 'loading', 'results', 'viewer', 'error'].forEach(s => {
    const el = document.getElementById(`state-${s}`);
    if (el) {
      el.classList.toggle('hidden', s !== state);
    }
  });
  if (state === 'loading') {
    updateLoadingText(message);
  }
  if (state === 'error') {
    document.getElementById('error-message').textContent = message;
  }
}

function updateLoadingText(text) {
  const el = document.getElementById('loading-text');
  if (el) el.textContent = text;
}

// Critical Rule 2: Strict XSS escaping for scraped UI text
function escapeHTML(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Helper: Yields thread to allow browser DOM to update loading states
function yieldToUI() {
  return new Promise(resolve => setTimeout(resolve, 0));
}