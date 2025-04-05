import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM fully loaded and parsed");
  chrome.runtime.sendMessage({ action: "POPUP_OPENED" });
});

window.addEventListener("beforeunload", () => {
  chrome.runtime.sendMessage({ action: "POPUP_CLOSED" });
});

// Render the React component
const container = document.getElementById("root");
const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
