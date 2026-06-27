// Privacy-first prototype service worker.
// It does not run stealth monitoring, capture screenshots, read page contents,
// record keystrokes, or send data to a server. A real version would require
// explicit consent and would only share broad categories with the Soryvo app.
chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeText({ text: "" });
});
