import CONFIG from './config.js';

const SOURCES = [
  { name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { name: 'The Guardian', url: 'https://www.theguardian.com/world/rss' },
  { name: 'NPR World', url: 'https://feeds.npr.org/1004/rss.xml' },
  { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
  { name: 'Sky News', url: 'https://news.sky.com/feeds/rss/world.xml' },
  { name: 'France 24', url: 'https://www.france24.com/en/rss' }
];

const container = document.getElementById('news-container');
const status = document.getElementById('status');
const refreshBtn = document.getElementById('refresh-btn');
const loadMoreBtn = document.getElementById('load-more-btn');
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const apiKeyInput = document.getElementById('api-key-input');
const saveSettingsBtn = document.getElementById('save-settings');
const closeSettingsBtn = document.getElementById('close-settings');
const footerText = document.getElementById('footer-text');

let allFetchedHeadlines = [];
let displayedNews = []; // Stores the full news objects
let displayedTitles = new Set();
let apiKey = '';

// Load data from storage on startup
async function loadAppData() {
  footerText.textContent = `Powered by ${CONFIG.MODEL_NAME}`;
  const data = await chrome.storage.local.get(['gemini_api_key', 'cached_news']);
  apiKey = data.gemini_api_key;
  
  if (!apiKey) {
    status.textContent = 'Please click settings to enter your API key';
    settingsModal.style.display = 'flex';
    return;
  }

  if (data.cached_news && data.cached_news.length > 0) {
    displayedNews = data.cached_news;
    renderCachedNews();
    status.textContent = 'Showing saved news';
  } else {
    fetchNews(true);
  }
}

async function fetchNews(isInitial = true) {
  if (!apiKey) return;

  if (isInitial) {
    setLoading(true);
    container.innerHTML = '';
    displayedTitles.clear();
    displayedNews = [];
    allFetchedHeadlines = [];
    await chrome.storage.local.remove('cached_news');
  } else {
    loadMoreBtn.textContent = 'Analyzing more...';
    loadMoreBtn.disabled = true;
  }
  
  status.textContent = isInitial ? 'Fetching global sources...' : 'Gathering more stories...';
  
  try {
    if (allFetchedHeadlines.length === 0) {
      const fetchPromises = SOURCES.map(async (source) => {
        try {
          const response = await fetch(source.url);
          const text = await response.text();
          const parser = new DOMParser();
          const xml = parser.parseFromString(text, 'text/xml');
          const items = Array.from(xml.querySelectorAll('item')).slice(0, 15);
          
          return items.map(item => ({
            title: item.querySelector('title')?.textContent,
            link: item.querySelector('link')?.textContent,
            source: source.name,
            description: item.querySelector('description')?.textContent
          }));
        } catch (err) {
          return [];
        }
      });

      const results = await Promise.all(fetchPromises);
      results.forEach(res => {
        if (res && res.length > 0) allFetchedHeadlines.push(...res);
      });
    }

    status.textContent = 'Gemini is finding new stories...';
    const newStories = await getGeminiAnalysis(allFetchedHeadlines, Array.from(displayedTitles));
    
    if (newStories && newStories.length > 0) {
      displayedNews.push(...newStories);
      await chrome.storage.local.set({ cached_news: displayedNews });
      renderBatch(newStories);
    }
    status.textContent = 'Updated just now';
  } catch (err) {
    status.textContent = 'Error: ' + err.message;
    if (isInitial) {
      container.innerHTML = `<div class="status-msg" style="color:#ef4444">${err.message}</div>`;
    }
  } finally {
    setLoading(false);
    loadMoreBtn.textContent = 'Show 5 More Stories';
    loadMoreBtn.disabled = false;
  }
}

async function getGeminiAnalysis(headlines, excludedTitles) {
  const prompt = `
    I am providing you with a list of news headlines from multiple global sources.
    Your task is to identify 5 significant WORLD news stories that ARE NOT in this excluded list:
    Excluded Stories: ${JSON.stringify(excludedTitles)}

    For each of the 5 NEW stories, provide:
       - A short, punchy title.
       - A concise 1-2 sentence summary.
       - The name of the primary source.
       - The original URL link.
    
    Return the result ONLY as a JSON array of objects with keys: "title", "summary", "source", "link".
    If you can't find 5 unique ones, return as many as you can.

    Data:
    ${JSON.stringify(headlines.map(h => ({ t: h.title, d: h.description, s: h.source, l: h.link })))}
  `;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.MODEL_NAME}:generateContent?key=${apiKey}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" }
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Gemini API request failed');
  }

  const data = await response.json();
  const resultText = data.candidates[0].content.parts[0].text;
  return JSON.parse(resultText);
}

function renderCachedNews() {
  container.innerHTML = '';
  displayedTitles.clear();
  renderBatch(displayedNews);
}

function renderBatch(newsItems) {
  if (!newsItems || newsItems.length === 0) {
    if (displayedNews.length === 0) loadMoreBtn.style.display = 'none';
    status.textContent = 'No more unique stories found.';
    return;
  }

  newsItems.forEach((item, index) => {
    if (displayedTitles.has(item.title)) return;
    displayedTitles.add(item.title);

    const div = document.createElement('div');
    div.className = 'news-item';
    div.style.animationDelay = `${index * 0.1}s`;
    div.innerHTML = `
      <div class="news-tag">${item.source}</div>
      <div class="news-title">${item.title}</div>
      <div class="news-summary">${item.summary}</div>
    `;
    
    div.addEventListener('click', () => {
      if (item.link) {
        window.open(item.link, '_blank');
      }
    });
    
    container.appendChild(div);
  });

  loadMoreBtn.style.display = 'block';
}

function setLoading(isLoading) {
  if (isLoading) {
    loadMoreBtn.style.display = 'none';
    container.innerHTML = `
      <div class="skeleton"></div>
      <div class="skeleton"></div>
      <div class="skeleton"></div>
      <div class="skeleton"></div>
      <div class="skeleton"></div>
    `;
    refreshBtn.classList.add('spinning');
  } else {
    refreshBtn.classList.remove('spinning');
  }
}

// UI Handlers
settingsBtn.addEventListener('click', () => {
  apiKeyInput.value = apiKey || '';
  settingsModal.style.display = 'flex';
});

closeSettingsBtn.addEventListener('click', () => {
  settingsModal.style.display = 'none';
});

saveSettingsBtn.addEventListener('click', async () => {
  const newKey = apiKeyInput.value.trim();
  if (newKey) {
    await chrome.storage.local.set({ gemini_api_key: newKey });
    apiKey = newKey;
    settingsModal.style.display = 'none';
    fetchNews(true);
  }
});

// Initial load
loadAppData();

refreshBtn.addEventListener('click', () => fetchNews(true));
loadMoreBtn.addEventListener('click', () => fetchNews(false));
