// This bridge runs only on Soryvo pages. It forwards sanitized session signals
// and never reads the page, URLs, tab titles, messages, or form contents.
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "SORYVO_ACTIVITY_SIGNAL") {
    postSignal(message.signal);
  }
});

window.addEventListener("message", (event) => {
  if (event.source !== window || event.data?.type !== "SORYVO_REQUEST_ACTIVITY_SIGNAL") {
    return;
  }

  void chrome.runtime.sendMessage({ type: "SORYVO_GET_SIGNAL" }).then(postSignal);
});

void chrome.runtime.sendMessage({ type: "SORYVO_GET_SIGNAL" }).then(postSignal);

function postSignal(signal) {
  window.postMessage({
    source: "soryvo-extension",
    type: "SORYVO_ACTIVITY_SIGNAL",
    signal
  }, window.location.origin);
}
