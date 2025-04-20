const URLS_FOR_SIDEPANEL = ["https://www.youtube.com/watch"];

export async function setSidePanelEnabled(tabId, url) {
  try {
    await chrome.sidePanel.setOptions({
      tabId,
      path: "src/user-interface/index/sidepanel.html",
      enabled: URLS_FOR_SIDEPANEL.some((urlForSidepanel) =>
        url.startsWith(urlForSidepanel)
      ),
    });
  } catch (error) {
    throw new Error(`setSidePanelEnabled failed: ${error.message}`);
  }
}
