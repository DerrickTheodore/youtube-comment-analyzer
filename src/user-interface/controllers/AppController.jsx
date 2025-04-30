import React from "react";
import {
  useInitialTabSetup,
  useTabViewRefreshKey,
} from "../hooks/useTabEvents"; // Import custom hooks
import YouTubeView from "../views/YouTubeView";

function AppController() {
  // Use the custom hook for initial setup - capture initialVideoId
  const [initialLoading, initialError, currentTabId, initialVideoId] =
    useInitialTabSetup();

  // Use the custom hook to get the refresh key - pass initialVideoId
  const viewKey = useTabViewRefreshKey(currentTabId, initialVideoId);

  // Render logic remains largely the same, using state from hooks
  return (
    <div className="app-controller">
      {initialLoading ? (
        <div className="loading-spinner">
          <div className="spinner"></div>
        </div>
      ) : initialError ? (
        <div className="error-message">
          <p>{initialError}</p>
        </div>
      ) : (
        // Pass the viewKey obtained from the custom hook
        <YouTubeView key={viewKey} />
      )}
    </div>
  );
}

export default AppController;
