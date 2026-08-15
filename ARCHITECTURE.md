🏗️ Architecture Breakdown 

We are splitting this project into four distinct 

layers:

1. The Trigger (Extension Core)

manifest.json: The V3 configuration that asks for active tab permissions.

background.js: The service worker. Instead of a tiny popup, it listens for the extension icon click and opens a massive, full-page dashboard in a new tab.  

2. The Scraper (Content Script)

content.js: Injected directly into the AI site. It listens for a command from the dashboard, traverses the DOM using specific CSS selectors (e.g., div[data-message-author-role="user"] for ChatGPT), extracts the raw text and roles, and sends an array of messages back.  

3. The Brain (Local NLP Pipeline)This is where the heavy lifting happens, completely in vanilla JS without external libraries:  

tokenizer.js: Cleans the text. It lowercases, strips punctuation, preserves code blocks, removes a hardcoded list of ~150 English stopwords, and applies a simplified Porter Stemmer (e.g., "running" → "run").  

tfidf.js: The scoring engine. Calculates Term Frequency-Inverse Document Frequency (TF-IDF) to figure out which words actually matter in a specific message compared to the whole chat.  

similarity.js: The boundary detector. Uses a sliding window (3 messages wide) to compare the Jaccard similarity of keywords between messages. If similarity drops below 0.25, it marks a topic shift.

chunker.js: Groups the messages between those boundaries. It aggregates the TF-IDF scores for the chunk to generate a 3-word title (e.g., "Python · Loop · Range"). 

 4. The UI (Dashboard)dashboard.html / dashboard.css: A dark-themed, responsive grid layout for the topic cards and a slide-in viewer to read the exact messages in that chunk.  
 
 dashboard.js: The orchestrator. It triggers content.js to scrape, catches the data, runs it sequentially through our pipeline scripts, and renders the UI. 

Human Drawn Workflow: ![Checkout](Human%20Drawn%20Workflow.jpeg)
