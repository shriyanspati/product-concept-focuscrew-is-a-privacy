// Privacy-first session signal worker. It never requests browser history,
// reads page contents, or stores URLs, titles, search terms, or screenshots.
const signalKey = "soryvoActivitySignal";
const emptySignal = {
  enabled: false,
  category: "unknown",
  tabSwitchCount: 0
};

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.session.remove(signalKey);
  await chrome.action.setBadgeText({ text: "" });
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const signal = await getSignal();
  if (!signal.enabled) {
    return;
  }

  try {
    const tab = await chrome.tabs.get(tabId);
    await publishSignal({
      enabled: true,
      category: categorizeUrl(tab.url),
      tabSwitchCount: signal.tabSwitchCount + 1
    });
  } catch {
    await publishSignal({ ...signal, category: "unknown" });
  }
});

chrome.tabs.onUpdated.addListener(async (_tabId, changeInfo, tab) => {
  if (!tab.active || !changeInfo.url) {
    return;
  }

  const signal = await getSignal();
  if (!signal.enabled) {
    return;
  }

  await publishSignal({
    ...signal,
    category: categorizeUrl(changeInfo.url)
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "SORYVO_START_SIGNALS") {
    void startSignals().then(sendResponse);
    return true;
  }

  if (message?.type === "SORYVO_STOP_SIGNALS") {
    void stopSignals().then(sendResponse);
    return true;
  }

  if (message?.type === "SORYVO_GET_SIGNAL") {
    void getSignal().then(sendResponse);
    return true;
  }

  return false;
});

async function startSignals() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const signal = {
    enabled: true,
    category: categorizeUrl(tab?.url),
    tabSwitchCount: 0
  };
  await publishSignal(signal);
  await chrome.action.setBadgeText({ text: "ON" });
  return signal;
}

async function stopSignals() {
  await chrome.storage.session.remove(signalKey);
  await chrome.action.setBadgeText({ text: "" });
  await notifySoryvoTabs(emptySignal);
  return emptySignal;
}

async function getSignal() {
  const stored = await chrome.storage.session.get(signalKey);
  return sanitizeSignal(stored[signalKey]);
}

async function publishSignal(signal) {
  const sanitized = sanitizeSignal(signal);
  await chrome.storage.session.set({ [signalKey]: sanitized });
  await notifySoryvoTabs(sanitized);
  return sanitized;
}

async function notifySoryvoTabs(signal) {
  const tabs = await chrome.tabs.query({
    url: ["http://localhost/*", "http://127.0.0.1/*"]
  });

  await Promise.allSettled(tabs.map((tab) =>
    tab.id ? chrome.tabs.sendMessage(tab.id, { type: "SORYVO_ACTIVITY_SIGNAL", signal }) : Promise.resolve()
  ));
}

function sanitizeSignal(value) {
  const categories = ["study_tool", "writing_tool", "research_tool", "neutral_tool", "social_media", "unknown"];
  return {
    enabled: value?.enabled === true,
    category: categories.includes(value?.category) ? value.category : "unknown",
    tabSwitchCount: Number.isInteger(value?.tabSwitchCount)
      ? Math.max(0, Math.min(999, value.tabSwitchCount))
      : 0
  };
}

function categorizeUrl(rawUrl = "") {
  let hostname = "";
  try {
    hostname = new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return "unknown";
  }

  if (["docs.google.com", "notion.so", "www.notion.so", "office.com", "www.office.com"].some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))) {
    return "writing_tool";
  }

  if (["wikipedia.org", "britannica.com", "scholar.google.com", "jstor.org"].some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))) {
    return "research_tool";
  }

  if (["khanacademy.org", "quizlet.com", "instructure.com", "desmos.com", "github.com", "replit.com"].some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))) {
    return "study_tool";
  }

  if (["instagram.com", "tiktok.com", "reddit.com", "x.com", "twitter.com", "facebook.com"].some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))) {
    return "social_media";
  }

  return "neutral_tool";
}
