import React, { useState, useEffect, useCallback, useRef } from "react";
import SQLEditor from "./components/SQLEditor";

function App() {
  const [query, setQuery] = useState("");
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [enableUI, setEnableUI] = useState(null);
  const executionStateRef = useRef({
    isExecuting: false,
    lastRequestId: 0,
  });

  useEffect(() => {
    const handleVideoViewed = (request, sender, sendResponse) => {
      if (request.action === "VIDEO_VIEWED") {
        try {
          const { videoId } = request.payload;
          console.log("App() => Video viewed:", videoId);
          setEnableUI(videoId);
          setComments([]);
          setError(null);
        } catch (err) {
          console.error("Error handling video change:", err);
          setError(err.message);
        }
      }
    };

    chrome.runtime.onMessage.addListener(handleVideoViewed);

    return () => {
      chrome.runtime.onMessage.removeListener(handleVideoViewed);
    };
  }, []);

  useEffect(() => {
    chrome.runtime.sendMessage({ action: "POPUP_OPENED" });

    return () => {
      chrome.runtime.sendMessage({ action: "POPUP_CLOSED" });
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
        console.log(
          "requestId",
          requestId,
          "executionStateRef.current.lastRequestId",
          executionStateRef.current.lastRequestId
        );

        if (requestId === executionStateRef.current.lastRequestId) {
          if (response.status === "ERROR") {
            throw new Error(response.error);
          }

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

          setComments(transformComments(response.results));
        }
      })
      .catch((error) => {
        console.error("Query execution error:", error);
        setError(error.message);
      })
      .finally(() => {
        executionStateRef.current.isExecuting = false;
        setLoading(false);
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

  console.log("STATE UPDATED IN APP", {
    query,
    comments,
    loading,
    error,
    enableUI,
    executionStateCurrent: executionStateRef.current,
  });

  return (
    <div className="youtube-comments-container">
      <h1>YouTube Comment Analyzer</h1>
      <SQLEditor onChange={handleQueryChange} />
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

export default App;
