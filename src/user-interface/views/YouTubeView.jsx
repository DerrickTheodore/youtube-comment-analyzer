import React, { useState, useEffect, useCallback, useRef } from "react";
import SQLEditor from "../components/SQLEditor";

function YouTubeView() {
  const [query, setQuery] = useState(
    "SELECT *\nFROM comments\nORDER BY\n\tlikeCount DESC,\n\tpublishedAt DESC\nLIMIT 10"
  );
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [enableUI, setEnableUI] = useState(false);
  const executionStateRef = useRef({
    isExecuting: false,
    lastRequestId: 0,
  });

  useEffect(() => {
    // Define listener handlers
    const handleDataFetch = async (changes, areaName) => {
      if (areaName === "local" && changes.tabsDataFetch) {
        const storedTabsDataFetch = changes.tabsDataFetch.newValue;
        const [{ id: storedTabsDataFetchKey }] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        const dataFetch =
          storedTabsDataFetch[storedTabsDataFetchKey.toString()];

        if (dataFetch === "loading") {
          setLoading(true);
        } else if (dataFetch === "done") {
          setLoading(false);
          setEnableUI(true);
          setComments([]);
        } else {
          setLoading(false);
          setEnableUI(false);
          setComments([]);
          setError("Error fetching data");
        }
      }
    };

    const handleQueryFetchResults = async (request, sender, sendResponse) => {
      const { action, payload } = request;
      const [{ id: currentTabId }] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (action === "QUERY_RESULT" && payload?.tabId === currentTabId) {
        const transformComments = (results) => {
          return results.flatMap((result) => {
            return result.values.map((row) => {
              return result.columns.reduce((acc, col, i) => {
                acc[col] = row[i];
                return acc;
              }, {});
            });
          });
        };

        setLoading(false);
        executionStateRef.current.isExecuting = false;
        setComments(transformComments(payload.results));
        sendResponse({ status: "success" });
      }
      return true; // Keep the message channel open for sendResponse
    };

    // Register the listener
    chrome.storage.onChanged.addListener(handleDataFetch);
    chrome.runtime.onMessage.addListener(handleQueryFetchResults);

    // Cleanup function to remove the listener
    return () => {
      chrome.storage.onChanged.removeListener(handleDataFetch);
      chrome.runtime.onMessage.removeListener(handleQueryFetchResults);
    };
  }, []);

  const handleExecuteQuery = useCallback(async () => {
    if (executionStateRef.current.isExecuting) return;

    const requestId = Date.now();
    executionStateRef.current.lastRequestId = requestId;
    executionStateRef.current.isExecuting = true;
    setLoading(true);
    setError(null);
    setComments([]);

    chrome.runtime
      .sendMessage({
        action: "EXECUTE_QUERY",
        payload: { query },
      })
      .then((response) => {
        if (requestId === executionStateRef.current.lastRequestId) {
          if (response.status === "ERROR") {
            throw new Error(response.error);
          }

          if (response.status === "TIMEOUT") {
            throw new Error("Query execution command timed out");
          }
        }
      })
      .catch((error) => {
        console.error("Query execution error:", error);
        setError(error.message);
      });
  }, [query, executionStateRef.current.lastRequestId]);

  const handleQueryChange = useCallback((value) => {
    setQuery(value);
  }, []);

  const formatDate = (isoString) => {
    return new Date(isoString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="youtube-comments-container">
      <h1>YouTube Comment Analyzer</h1>
      <SQLEditor value={query} onChange={handleQueryChange} />
      <button
        onClick={handleExecuteQuery}
        disabled={!enableUI || executionStateRef.current.isExecuting}
        className="execute-btn"
      >
        {executionStateRef.current.isExecuting
          ? "Processing..."
          : "Execute Query"}
      </button>

      {loading && <div className="loading">Loading comments...</div>}
      {error && <div className="error">Error: {error}</div>}

      <div className="comments-list">
        {comments.map((comment) => (
          <div key={comment.id} className="comment-thread">
            <div className="comment">
              <div className="comment-avatar">
                <img
                  src={comment.authorProfileImageUrl || "default-avatar.png"}
                  loading="lazy"
                  alt={`${comment.authorDisplayName}'s avatar`}
                  className="avatar-img"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = chrome.runtime.getURL(
                      "assets/default-avatar.png"
                    );
                  }}
                />
              </div>
              <div className="comment-content">
                <div className="comment-header">
                  <span className="comment-author">
                    {comment.authorDisplayName}
                  </span>
                  <span className="comment-time">
                    {formatDate(comment.publishedAt)}
                  </span>
                </div>
                <div className="comment-text">{comment.textOriginal}</div>
                <div className="comment-actions">
                  <img
                    src="assets/thumbs-up.png"
                    alt="Like"
                    className="like-icon"
                  />
                  <span className="like-count">{comment.likeCount}</span>
                  {comment.totalReplyCount > 0 && (
                    <button className="view-replies-btn">
                      View replies ({comment.totalReplyCount})
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default YouTubeView;
