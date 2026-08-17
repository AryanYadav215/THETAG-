/**
 * Chat Topic Divider - Content Script Scraper
 * Layer 1 & 2: Cascading Selectors prioritizing test-ids and structural fallbacks.
 */
const SITE_STRATEGIES = {
  'claude.ai': {
    primary: {
      user: '[data-testid="user-message"]',
      assistant: 'div.font-claude-message, [data-testid="assistant-message"]',
      container: '[data-testid="user-message"], div.font-claude-message, [data-testid="assistant-message"]'
    },
    fallbacks: [
      {
        user: '[data-is-streaming="false"]:has(.font-user-message)',
        assistant: '[data-is-streaming="false"]:has(.font-claude-message)',
        container: 'div[class*="ChatMessage"], div[class*="chat-message"]'
      }
    ]
  },
  'chatgpt.com': {
    primary: {
      user: 'div[data-message-author-role="user"]',
      assistant: 'div[data-message-author-role="assistant"]',
      container: 'div[data-message-author-role]'
    },
    fallbacks: [
      {
        user: 'article:has([data-message-author-role="user"])',
        assistant: 'article:has([data-message-author-role="assistant"])',
        container: 'article[data-testid*="conversation-turn"]'
      }
    ]
  },
  'gemini.google.com': {
    primary: {
      user: 'user-query',
      assistant: 'model-response',
      container: 'user-query, model-response'
    },
    fallbacks: [
      {
        user: '.query-content, [class*="query-content"]',
        assistant: '.response-content, [class*="response-content"]',
        container: '.query-content, .response-content, [class*="query-content"], [class*="response-content"]'
      }
    ]
  },
  'perplexity.ai': {
    primary: {
      user: 'div[class*="query"], [data-testid="user-query"]',
      assistant: 'div[class*="answer"], [data-testid="answer"]',
      container: 'div[class*="query"], div[class*="answer"], [data-testid="thread-message"]'
    },
    fallbacks: [
      {
        user: '[class*="userMessage"], [class*="UserMessage"]',
        assistant: '[class*="assistantMessage"], [class*="AssistantMessage"]',
        container: 'div[class*="Message"]'
      }
    ]
  }
};

/**
 * Layer 3: The Heuristic Engine
 * Engages dynamically when specific DOM selectors fail.
 */
const HeuristicEngine = {
  deduceRole(originalNode) {
    let userScore = 0;
    let assistantScore = 0;

    // 1. Semantic Markup: Keyword signals in attributes
    const outerHTML = originalNode.outerHTML.toLowerCase();
    if (/(user|human|person|query)/.test(outerHTML)) userScore += 1;
    if (/(bot|assistant|agent|ai|model|response|answer)/.test(outerHTML)) assistantScore += 1;

    // 2. Component Markers: Code blocks imply Assistant payloads
    if (originalNode.querySelector('pre, code, table, [aria-label*="copy" i]')) {
      assistantScore += 2; 
    }

    // 3. Layout Alignment Metrics: Right-aligned/flex-end implies User text
    try {
      const style = window.getComputedStyle(originalNode);
      if (style.textAlign === 'right' || style.alignSelf === 'flex-end' || style.justifyContent === 'flex-end') {
        userScore += 2; 
      }
    } catch (e) {
      // Ignore if DOM node throws style error
    }

    return userScore >= assistantScore ? 'User' : 'Assistant';
  },

  cleanNode(clone) {
    // Smart Data Scrubbing: Purge noise code before text extraction
    const noiseSelectors = [
      'button', 'svg', 'nav', 'footer',
      '[role="toolbar"]', '[class*="action" i]',
      '[aria-label*="copy" i]', '[class*="feedback" i]',
      '[class*="avatar" i]'
    ];
    clone.querySelectorAll(noiseSelectors.join(', ')).forEach(el => el.remove());
    return (clone.innerText || clone.textContent || '').trim();
  },

  run() {
    console.warn('Chat Topic Divider: Specific selectors failed. Engaging Heuristic Engine.');
    
    // Find generic blocks that could potentially be chat wrappers
    let candidates = Array.from(document.querySelectorAll('main article, main [data-testid*="message"], div[class*="message"], div[class*="turn"]'));
    
    if (candidates.length === 0) {
      // Final fallback: Target elements wrapping native paragraphs
      const paragraphs = Array.from(document.querySelectorAll('p'));
      candidates = [...new Set(paragraphs.map(p => p.parentElement))];
    }

    const rawMessages = [];
    candidates.forEach(node => {
      const role = this.deduceRole(node);
      const text = this.cleanNode(node.cloneNode(true));
      
      if (text.length > 10) {
        rawMessages.push({ role, text });
      }
    });

    // Deduplication Engine: Prevents duplicate reads of nested DOM containers
    const cleanMessages = [];
    rawMessages.forEach(msg => {
      const prev = cleanMessages[cleanMessages.length - 1];
      if (prev && (prev.text.includes(msg.text) || msg.text.includes(prev.text))) {
        if (msg.text.length > prev.text.length) {
          cleanMessages[cleanMessages.length - 1] = msg; // Overwrite with the larger context
        }
      } else {
        cleanMessages.push(msg);
      }
    });

    if (cleanMessages.length === 0) {
      throw new Error('Heuristic Engine failed to extract readable conversation from the page layout.');
    }

    return cleanMessages;
  }
};

// --- Execution & Messaging ---

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SCRAPE_MESSAGES') {
    try {
      const messages = scrapeMessages();
      sendResponse({ success: true, messages });
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }
    return true; // Keep the message channel open for asynchronous responses
  }
});

function scrapeMessages() {
  const hostname = window.location.hostname.replace('www.', '');
  const siteConfig = SITE_STRATEGIES[hostname];

  if (!siteConfig) {
    throw new Error(`Site not supported: ${hostname}`);
  }

  // Attempt Primary Selectors First
  let strategy = siteConfig.primary;
  let containers = document.querySelectorAll(strategy.container);

  // Attempt Fallback Selectors if Primary fails
  if (!containers || containers.length === 0) {
    for (const fallback of siteConfig.fallbacks) {
      const candidateContainers = document.querySelectorAll(fallback.container);
      if (candidateContainers && candidateContainers.length > 0) {
        strategy = fallback;
        containers = candidateContainers;
        break;
      }
    }
  }

  // Engage Layer 3 Heuristic Engine if completely unreadable
  if (!containers || containers.length === 0) {
    return HeuristicEngine.run();
  }

  const messages = [];

  // Scrape via found targeted selectors
  containers.forEach((node) => {
    const clone = node.cloneNode(true);
    const text = HeuristicEngine.cleanNode(clone); // Reuse smart scrubbing
    
    if (!text || text.length < 3) return;

    const isUser = node.matches(strategy.user) || !!node.querySelector(strategy.user);
    const role = isUser ? 'User' : 'Assistant';

    messages.push({ role, text });
  });

  if (messages.length === 0) {
    throw new Error('No readable message text could be extracted from this conversation.');
  }

  return messages;
}