import React, { useEffect } from "react";
import YouTubeView from "../views/YouTubeView";

function AppController() {
  useEffect(() => {
    chrome.runtime
      .sendMessage({ action: "POPUP_OPENED" })
      .then()
      .catch((error) => {
        console.error("Error sending message to service worker:\n", error);
      });

    return () => {
      chrome.runtime.sendMessage({ action: "POPUP_CLOSED" });
    };
  }, []);

  return <div className="app-controller">{<YouTubeView />}</div>;
}

export default AppController;
