import React, { useEffect, useState } from "react";
import YouTubeView from "../views/YouTubeView";

/**
 * Initializes the application controller and sets up event listeners.
 */
function AppController() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  useEffect(() => {
    setLoading(true);
    chrome.tabs
      .query({ active: true, currentWindow: true })
      .then(([tab]) => {
        chrome.sidePanel.getOptions({ tabId: tab.id }).then(({ enabled }) => {
          if (!enabled) {
            window.close();
            return;
          }
          setLoading(false);
        });
      })
      .catch((error) => {
        setError("Error querying tab's sidepanel options");
        setLoading(false);
        console.error("Error querying tab's sidepanel options:", error);
      });
  });

  return (
    <div className="app-controller">
      {loading ? (
        <div className="loading-spinner">
          <div className="spinner"></div>
        </div>
      ) : error ? (
        <div className="error-message">
          <p>{error}</p>
        </div>
      ) : (
        <YouTubeView />
      )}
    </div>
  );
}

export default AppController;
