const categoryNode = document.querySelector("#category");
const refreshButton = document.querySelector("#refresh");

async function refreshCategory() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url ?? "";
  categoryNode.textContent = categorizeUrl(url);
}

function categorizeUrl(url) {
  const lower = url.toLowerCase();

  if (!lower || lower.startsWith("chrome://")) {
    return "Browser page";
  }

  if (lower.includes("docs.google") || lower.includes("notion") || lower.includes("word")) {
    return "Writing tool";
  }

  if (lower.includes("khanacademy") || lower.includes("quizlet") || lower.includes("wikipedia") || lower.includes("canvas")) {
    return "Study tool";
  }

  if (lower.includes("instagram") || lower.includes("tiktok") || lower.includes("reddit") || lower.includes("x.com")) {
    return "Social media";
  }

  return "General web";
}

refreshButton.addEventListener("click", refreshCategory);
void refreshCategory();
