import { handleRequest } from "./service-controller.js";
import { closeDatabase } from "./service-infra.js";
import "./service-init.js";
import { setSidePanelEnabled } from "./service-utils.js";

// Tab Event listeners (Worker to React)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    setSidePanelEnabled(tab.id, tab.url);
  } catch (error) {
    console.error("Handling tab update", error);
  }
});
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  try {
    if (changeInfo.status !== "complete") return;
    if (tab.url !== changeInfo.url) await setSidePanelEnabled(tabId, tab.url);
  } catch (error) {
    console.error("Handling tab update", error);
  }
});

// Message Event listeners
chrome.runtime.onMessage.addListener(async (request, _sender, sendResponse) => {
  try {
    if (
      ["EXECUTE_QUERY", "POPUP_OPENED", "DATA_FETCH_START"].includes(
        request.action
      )
    ) {
      handleRequest(request, sendResponse);
    }
  } catch (error) {
    sendResponse({ status: "ERROR", error: error.message });
    return true;
  }
});

chrome.runtime.onSuspend.addListener(() => {
  console.log("Service worker is shutting down. Closing database...");
  closeDatabase();
});
