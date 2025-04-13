import React from "react";
import { createRoot } from "react-dom/client";
import AppController from "../controllers/AppController";

// Handlers
const handleSidePanelMessages = (request, _sender, sendResponse) => {
  try {
    if (request.action === "CLOSE_SIDE_PANEL") {
      window.close();
      sendResponse({ status: "success", message: "Side panel closed" });
    }
  } catch (err) {
    console.error("Error handling side panel close:", err);
  } finally {
    return true;
  }
};
// Listeners
chrome.runtime.onMessage.addListener(handleSidePanelMessages);
// Cleanup
window.addEventListener("beforeunload", () => {
  chrome.runtime.onMessage.removeListener(handleSidePanelMessages);
});
// ReactDOM rendering
const container = document.getElementById("root");
const root = createRoot(container);
root.render(
  <React.StrictMode>
    <AppController />
  </React.StrictMode>
);
