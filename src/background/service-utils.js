const URLS_FOR_SIDEPANEL = ["https://www.youtube.com/watch"];

export async function setSidePanelEnabled(tabId, url) {
  try {
    const enabled = URLS_FOR_SIDEPANEL.some((urlForSidepanel) =>
      url.startsWith(urlForSidepanel)
    );
    await chrome.sidePanel.setOptions({
      tabId,
      path: "src/user-interface/index/sidepanel.html",
      enabled,
    });
    return enabled;
  } catch (error) {
    throw new Error(`setSidePanelEnabled failed: ${error.message}`);
  }
}

export async function getCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    return tab;
  } catch (error) {
    console.error("Error getting tab ID:", error);
    throw error;
  }
}

export async function getCurrentWindow() {
  try {
    const [window] = await chrome.windows.getAll({
      populate: true,
      windowTypes: ["normal"],
    });
    return window;
  } catch (error) {
    console.error("Error getting current window:", error);
    throw error;
  }
}

export async function getCurrentURL() {
  try {
    const tab = await getCurrentTab();
    return tab?.url;
  } catch (error) {
    console.error("Error getting current URL:", error);
    throw error;
  }
}
