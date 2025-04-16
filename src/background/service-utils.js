export async function setSidePanelEnabled(tabId, url) {
  try {
    await chrome.sidePanel.setOptions({
      tabId,
      path: "src/user-interface/index/sidepanel.html",
      enabled: url.startsWith("https://www.youtube.com/watch"),
    });
  } catch (error) {
    throw new Error(`setSidePanelEnabled failed: ${error.message}`);
  }
}
