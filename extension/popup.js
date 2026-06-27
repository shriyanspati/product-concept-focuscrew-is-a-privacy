const statusNode = document.querySelector("#status");
const categoryNode = document.querySelector("#category");
const switchCountNode = document.querySelector("#switch-count");
const startButton = document.querySelector("#start");
const stopButton = document.querySelector("#stop");

startButton.addEventListener("click", async () => {
  render(await chrome.runtime.sendMessage({ type: "SORYVO_START_SIGNALS" }));
});

stopButton.addEventListener("click", async () => {
  render(await chrome.runtime.sendMessage({ type: "SORYVO_STOP_SIGNALS" }));
});

void chrome.runtime.sendMessage({ type: "SORYVO_GET_SIGNAL" }).then(render);

function render(signal) {
  const enabled = signal?.enabled === true;
  statusNode.textContent = enabled ? "Sharing broad signals" : "Sharing off";
  statusNode.classList.toggle("active", enabled);
  categoryNode.textContent = formatCategory(signal?.category);
  switchCountNode.textContent = String(signal?.tabSwitchCount ?? 0);
  startButton.disabled = enabled;
  stopButton.disabled = !enabled;
}

function formatCategory(category) {
  const labels = {
    study_tool: "Study tool",
    writing_tool: "Writing tool",
    research_tool: "Research page",
    neutral_tool: "General tool",
    social_media: "Social media",
    unknown: "Unknown"
  };
  return labels[category] ?? labels.unknown;
}
