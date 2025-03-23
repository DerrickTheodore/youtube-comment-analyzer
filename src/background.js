chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getVideoId") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab.url.includes("youtube.com/watch")) {
        const videoId = new URL(tab.url).searchParams.get("v");
        sendResponse({ videoId });
      } else {
        sendResponse({ error: "Not a YouTube video page." });
      }
    });
    return true; // Required for async sendResponse
  }
});
