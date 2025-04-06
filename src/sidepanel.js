import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

const handleSidePanelMessages = (request, _sender, sendResponse) => {
  try {
    if (request.action === "CLOSE_SIDE_PANEL") {
      window.close();
    }
  } catch (err) {
    console.error("Error handling side panel close:", err);
  }
};

chrome.runtime.onMessage.addListener(handleSidePanelMessages);

window.addEventListener("beforeunload", () => {
  chrome.runtime.onMessage.removeListener(handleSidePanelMessages);
});

// Render the React component
const container = document.getElementById("root");
const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
