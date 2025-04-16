import React, { useEffect } from "react";
import YouTubeView from "../views/YouTubeView";

function AppController() {
  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      chrome.sidePanel.getOptions({ tabId: tab.id }).then(({ enabled }) => {
        if (enabled) {
          chrome.runtime
            .sendMessage({ action: "POPUP_OPENED" })
            .then((response) => {
              if (chrome.runtime.LastError) {
                console.error(
                  `Error POPUP_OPENED: ${response}`,
                  chrome.runtime.LastError
                );
              }
              console.log("Successful POPUP_OPENED: ", response);
            })
            .catch((error) => {
              console.error(
                "Error sending POPUP_OPENED to service worker:\n",
                error
              );
            });
        } else {
          window.close();
        }
      });
    }, []);
  });

  return <div className="app-controller">{<YouTubeView />}</div>;
}

export default AppController;
