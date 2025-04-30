import { handleExternalRequest } from "./service-controller.js";
import { closeDatabase } from "./service-infra.js";
import "./service-init.js";
import { setSidePanelEnabled } from "./service-utils.js";

// Tab Event listeners (Worker to React)
chrome.tabs.onActivated.addListener((activeInfo) => {
  console.log(
    "[ACTIVATED]: Tab activated",
    JSON.stringify({ activeInfo }, null, 2)
  );
  chrome.tabs.get(activeInfo.tabId).then(async (tab) => {
    const isSidePanelEnabled = await setSidePanelEnabled(tab.id, tab.url);
    if (isSidePanelEnabled) {
      console.log("[ACTIVATED]: Sidepanel enabled.");
    } else {
      console.log("[ACTIVATED]: Sidepanel disabled.");
    }
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  console.log(
    "[UPDATED]: Tab updated",
    JSON.stringify({ changeInfo }, null, 2)
  );
  if (!changeInfo?.url) return;
  setSidePanelEnabled(tabId, tab.url).then((isSidePanelEnabled) => {
    if (isSidePanelEnabled) {
      console.log("[UPDATED]: Sidepanel enabled.");
    } else {
      console.log("[UPDATED]: Sidepanel disabled.");
    }
  });
});

// External Message Event listeners (React to Worker)
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  try {
    if (
      [
        "EXECUTE_YOUTUBE_COMMENT_DATA_QUERY",
        "LOAD_YOUTUBE_VIEW_DATA",
        "LOAD_YOUTUBE_VIDEO_COMMENT_DATA",
      ].includes(request.action)
    ) {
      console.log(
        `(SERVICE_WORKER) REQUEST["${request.action}"]:\n${JSON.stringify(
          request,
          null,
          2
        )}`
      );
      handleExternalRequest(request);
      sendResponse({
        action: request.action,
        status: "SUCCESS",
        message: `Received action: ${request.action}`,
      });
    } else {
      sendResponse({
        action: request?.action || "'No Action Found'",
        status: "ERROR",
        error: "Unhandled action",
      });
    }
  } catch (error) {
    console.error("Error in onMessage listener:", error);
    sendResponse({
      action: request?.action || "'No Action Found'",
      status: "ERROR",
      error: error.message,
    });
  } finally {
    return true; // Keep the message channel open for async response
  }
});

chrome.runtime.onSuspend.addListener(() => {
  console.log("Service worker is shutting down. Closing database...");
  closeDatabase();
});
