import { useCallback, useEffect, useState } from "react";

// Helper to generate a unique key
const generateKey = () =>
  Date.now().toString(36) + Math.random().toString(36).substring(2, 15);

// Helper to extract video ID from YouTube URL
const extractVideoId = (url) => {
  if (!url || !url.includes("youtube.com/watch")) {
    return null;
  }
  try {
    const urlParams = new URL(url).searchParams;
    return urlParams.get("v");
  } catch (e) {
    console.error("Error parsing URL:", e);
    return null;
  }
};

/**
 * Hook to manage initial tab setup and side panel check.
 * Determines the current tab ID, initial video ID, and checks side panel status.
 * Closes the side panel window if it's not enabled initially or not a valid YouTube page.
 * @returns {[boolean, string | null, number | null, string | null]} [initialLoading, initialError, currentTabId, initialVideoId]
 */
export function useInitialTabSetup() {
  const [initialLoading, setInitialLoading] = useState(true);
  const [initialError, setInitialError] = useState(null);
  const [currentTabId, setCurrentTabId] = useState(null);
  const [initialVideoId, setInitialVideoId] = useState(null);

  useEffect(() => {
    let isMounted = true;

    chrome.tabs
      .query({ active: true, currentWindow: true })
      .then(([tab]) => {
        if (!isMounted) return null;
        if (!tab || !tab.id || !tab.url) {
          throw new Error("Could not get active tab information.");
        }

        const videoId = extractVideoId(tab.url);
        if (!videoId) {
          // Not a YouTube watch page, maybe close or show error
          console.log("Initial page is not a YouTube watch page, closing.");
          window.close();
          throw new Error("Side panel only works on YouTube video pages.");
        }

        setCurrentTabId(tab.id);
        setInitialVideoId(videoId); // Store initial video ID

        return chrome.sidePanel.getOptions({ tabId: tab.id });
      })
      .then((options) => {
        if (!isMounted) return;
        if (options && !options.enabled) {
          console.log("Side panel not enabled on initial load, closing.");
          window.close();
          // Error already set implicitly by closing, but can be explicit
          setInitialError("Side panel not enabled for this page.");
        }
        setInitialLoading(false);
      })
      .catch((error) => {
        if (!isMounted) return;
        console.error("Error during initial setup:", error);
        setInitialError(
          error.message || "An unexpected error occurred during setup."
        );
        setInitialLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return [initialLoading, initialError, currentTabId, initialVideoId];
}

/**
 * Hook to manage refreshing the view based on tab events (update, activation).
 * Listens for tab updates and activations for the specified tab ID.
 * Triggers a view refresh (updates key) *only if* the video ID changes.
 * Checks side panel status before refreshing or closes it.
 * @param {number | null} currentTabId The ID of the tab to monitor.
 * @param {string | null} initialVideoId The initial video ID from setup.
 * @returns {string} A key string that changes when a refresh is triggered.
 */
export function useTabViewRefreshKey(currentTabId, initialVideoId) {
  const [viewKey, setViewKey] = useState(generateKey());
  // Store the last known video ID associated with the current viewKey
  const [lastVideoId, setLastVideoId] = useState(initialVideoId);

  // Update lastVideoId when initialVideoId is first available
  useEffect(() => {
    if (initialVideoId) {
      setLastVideoId(initialVideoId);
    }
  }, [initialVideoId]);

  // Memoized callback to handle the refresh logic
  const triggerViewRefresh = useCallback(
    (sourceEvent, newVideoId) => {
      console.log(
        `Triggering view refresh (updating key) due to ${sourceEvent}. New video ID: ${newVideoId}`
      );
      setViewKey(generateKey());
      setLastVideoId(newVideoId); // Store the new video ID
    },
    [] // No dependencies needed here as it just sets state
  );

  // Effect to set up and clean up listeners
  useEffect(() => {
    if (!currentTabId) {
      return; // Don't add listeners if tab ID is not yet known
    }

    // Async handler for tab updates (reloads)
    const handleTabUpdate = async (tabId, changeInfo, tab) => {
      // Only act when the tab has finished loading
      if (tabId === currentTabId && changeInfo.status === "complete") {
        try {
          // Get updated tab info to ensure URL is current
          const updatedTab = await chrome.tabs.get(tabId);
          const currentVideoId = extractVideoId(updatedTab.url);

          // Check side panel status before deciding action
          const { enabled } = await chrome.sidePanel.getOptions({
            tabId: tabId,
          });

          if (!enabled || !currentVideoId) {
            // If panel disabled or URL is no longer a valid video page after reload
            console.log(
              `Side panel disabled or not a video page after onUpdated, closing.`
            );
            window.close();
          } else if (currentVideoId !== lastVideoId) {
            // *** CHANGE HERE: Only refresh if video ID changed ***
            triggerViewRefresh("onUpdated", currentVideoId);
          } else {
            console.log(
              `Tab updated, but video ID (${currentVideoId}) hasn't changed. No refresh needed.`
            );
          }
        } catch (err) {
          console.error("Error during onUpdated handling:", err);
          // Decide how to handle error, maybe close or show message
        }
      }
    };

    // Async handler for tab activation (remains the same)
    const handleTabActivation = async (activeInfo) => {
      if (activeInfo.tabId === currentTabId) {
        try {
          const tab = await chrome.tabs.get(activeInfo.tabId);
          const currentVideoId = extractVideoId(tab.url);

          // Check side panel status
          const { enabled } = await chrome.sidePanel.getOptions({
            tabId: activeInfo.tabId,
          });

          if (!enabled || !currentVideoId) {
            // If panel disabled or not a valid video page on activation
            console.log(
              `Side panel disabled or not a video page after onActivated, closing.`
            );
            window.close();
          } else if (currentVideoId !== lastVideoId) {
            // Only refresh if the video ID has changed
            triggerViewRefresh("onActivated", currentVideoId);
          } else {
            console.log(
              `Tab activated, but video ID (${currentVideoId}) hasn't changed. No refresh needed.`
            );
          }
        } catch (err) {
          console.error("Error during onActivated handling:", err);
          // Decide how to handle error
        }
      }
    };

    chrome.tabs.onUpdated.addListener(handleTabUpdate);
    chrome.tabs.onActivated.addListener(handleTabActivation);
    console.log(
      `Added onUpdated and onActivated listeners for tab ${currentTabId}`
    );

    return () => {
      chrome.tabs.onUpdated.removeListener(handleTabUpdate);
      chrome.tabs.onActivated.removeListener(handleTabActivation);
      console.log(`Removed listeners for tab ${currentTabId}`);
    };
    // triggerViewRefresh is stable due to useCallback([])
  }, [currentTabId, lastVideoId, triggerViewRefresh]);

  return viewKey;
}
