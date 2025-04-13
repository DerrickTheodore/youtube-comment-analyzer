import "./service-init.js";
import { setSidePanelEnabled } from "./service-utils.js";
import { handleRequest } from "./service-controller.js";

// Tab Event listeners
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab?.url) {
      await setSidePanelEnabled(tabId, tab.url);
      const storedTabOpenKey = tabId.toString();
      const storedTabOpenHash = await chrome.storage.local.get("tabsOpen");
      const isTabOpen = storedTabOpenHash["tabsOpen"][storedTabOpenKey];
      const sidePanel = await chrome.sidePanel.getOptions({ tabId });

      if (sidePanel.enabled && !isTabOpen) {
        await chrome.tabs.sendMessage(tabId, {
          action: "OPEN_SIDE_PANEL",
          payload: { tabId: tabId },
        });
      } else if (!sidePanel.enabled && isTabOpen) {
        await chrome.tabs.sendMessage(tabId, {
          action: "CLOSE_SIDE_PANEL",
        });
      }
    }
  } catch (error) {
    console.error("Handling tab activation", error);
  } finally {
    console.log("Completed tab activation handling for tabId:", tabId);
  }
});
chrome.tabs.onCreated.addListener(async (tab) => {
  try {
    if (tab?.url) {
      const tabId = tab.id;
      await setSidePanelEnabled(tabId, tab.url);
      const storedTabOpenKey = tabId.toString();
      const storedTabOpenHash = await chrome.storage.local.get("tabsOpen");
      const isTabOpen = storedTabOpenHash["tabsOpen"][storedTabOpenKey];
      const sidePanel = await chrome.sidePanel.getOptions({ tabId });

      if (sidePanel.enabled && !isTabOpen) {
        await chrome.tabs.sendMessage(tabId, {
          action: "OPEN_SIDE_PANEL",
          payload: { tabId: tabId },
        });
      } else if (!sidePanel.enabled && isTabOpen) {
        await chrome.tabs.sendMessage(tabId, {
          action: "CLOSE_SIDE_PANEL",
        });
      }
    }
  } catch (error) {
    console.error("Handling tab creation", error);
  } finally {
    console.log("Completed tab creation handling for tabId:", tab.id);
  }
});
chrome.tabs.onUpdated.addListener(async (tabId, _changeInfo, tab) => {
  try {
    if (!tab?.url) {
      await setSidePanelEnabled(tabId, tab.url);
      const storedTabOpenKey = tabId.toString();
      const storedTabOpenHash = await chrome.storage.local.get("tabsOpen");
      const isTabOpen = storedTabOpenHash["tabsOpen"][storedTabOpenKey];
      const sidePanel = await chrome.sidePanel.getOptions({ tabId });

      if (sidePanel.enabled && !isTabOpen) {
        await chrome.tabs.sendMessage(tabId, {
          action: "OPEN_SIDE_PANEL",
          payload: { tabId: tabId },
        });
      } else if (!sidePanel.enabled && isTabOpen) {
        await chrome.tabs.sendMessage(tabId, {
          action: "CLOSE_SIDE_PANEL",
        });
      }
    }
  } catch (error) {
    console.error("Handling tab update", error);
  } finally {
    console.log("Completed tab updating handling for tabId:", tab.id);
  }
});
chrome.tabs.onRemoved.addListener(async (tabId) => {
  try {
    const storedTabOpenKey = tabId.toString();
    const storedTabOpenHash = await chrome.storage.local.get(storedTabOpenKey);
    const isStoredTabOpen =
      typeof storedTabOpenHash[storedTabOpenKey] === Boolean.name.toLowerCase();
    if (isStoredTabOpen) await chrome.storage.local.remove(storedTabOpenKey);
  } catch (error) {
    console.error("Handling tab update", error);
  } finally {
    console.log("Completed tab removed handling for tabId:", tabId);
    return true; // Keep the message channel open for sendResponse
  }
});

// Message Event listeners
let isProcessing = false;
let pendingRequest = null;
const THRITY_SECONDS = 30000;
const PROCESSING_TIMEOUT = THRITY_SECONDS;

chrome.runtime.onMessage.addListener(async (request, _sender, sendResponse) => {
  try {
    if (
      ["EXECUTE_QUERY", "POPUP_OPENED", "POPUP_CLOSED"].includes(request.action)
    ) {
      if (isProcessing) {
        if (pendingRequest) clearTimeout(pendingRequest.timer);
        pendingRequest = { request, sendResponse };
        return true;
      }
      isProcessing = true;
      await handleRequest(request, sendResponse, PROCESSING_TIMEOUT, () => {
        isProcessing = false;
        pendingRequest = null;
      });
    }
  } catch (error) {
    console.error("Error in message listener:", error);
    sendResponse({ status: "ERROR", error: error.message });
    return true;
  } finally {
    console.log("Completed message handling for action:", request.action);
  }
});
