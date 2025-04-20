import React, { useCallback, useEffect, useState } from "react";
import SQLEditor from "../components/SQLEditor";

function YouTubeView() {
  const [query, setQuery] = useState(
    "SELECT *\nFROM comments\nORDER BY\n\tlikeCount DESC,\n\tpublishedAt DESC\nLIMIT 10"
  );
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [enableUI, setEnableUI] = useState(true);
  const [commentCount, setCommentCount] = useState({
    loaded: 0,
  });

  useEffect(() => {
    // Define listener handlers
    const handleDataFetch = async (request, _sender, sendResponse) => {
      const { action, payload } = request;
      if (action === "DATA_FETCH_LOADING") {
        setLoading(true);
        setEnableUI(false);
        sendResponse({
          status: "success",
          message: `Received action: ${action}`,
        });
      } else if (action === "DATA_FETCH_DONE") {
        setLoading(false);
        setEnableUI(true);
        setCommentCount({
          loaded: payload.totalInternalItems,
        });
        sendResponse({
          status: "success",
          message: `Received action: ${action}`,
        });
      } else if (action === "DATA_FETCH_ERROR") {
        setLoading(false);
        setEnableUI(true);
        setComments([]);
        setError("Error fetching data");
        sendResponse({
          status: "success",
          message: `Received action: ${action}`,
        });
      }
    };
    const handleQueryFetchResults = async (request, _sender, sendResponse) => {
      const { action, payload } = request;
      if (action === "QUERY_RESULT") {
        setLoading(false);
        setEnableUI(true);
        setComments(
          payload.results.flatMap((result) => {
            return result.values.map((row) => {
              return result.columns.reduce((acc, col, i) => {
                acc[col] = row[i];
                return acc;
              }, {});
            });
          })
        );
        sendResponse({
          status: "success",
          message: `Received action: ${action}`,
        });
      }
      return true; // Keep the message channel open for sendResponse
    };

    // Register the listener
    chrome.runtime.onMessage.addListener(handleDataFetch);
    chrome.runtime.onMessage.addListener(handleQueryFetchResults);

    // Cleanup function to remove the listener
    return () => {
      chrome.storage.onChanged.removeListener(handleDataFetch);
      chrome.runtime.onMessage.removeListener(handleQueryFetchResults);
    };
  }, []);

  useEffect(() => {
    try {
      chrome.runtime.sendMessage(
        {
          action: "LOAD_YOUTUBE_DATA",
        },
        () => {
          if (chrome.runtime?.lastError) {
            throw new Error(`${chrome.runtime?.lastError}`);
          }
        }
      );
    } catch (error) {
      console.error("Error initiating YouTube data load:", error);
      setError("Error initiating YouTube data load");
      setEnableUI(false);
    }
  }, []);

  const handleExecuteQuery = useCallback(async () => {
    setLoading(true);
    setComments([]);
    setError(null);
    chrome.runtime
      .sendMessage({
        action: "EXECUTE_QUERY",
        payload: { query },
      })
      .then((response) => {
        if (response.status === "ERROR") {
          throw new Error(response.error);
        }
      })
      .catch((error) => {
        console.error("Query execution error:", error);
        setLoading(false);
        setError(error.message);
      });
  }, [query]);

  const handleLoadMore = useCallback(async () => {
    setLoading(true);
    setEnableUI(false);
    chrome.runtime
      .sendMessage({
        action: "LOAD_YOUTUBE_DATA",
      })
      .then((response) => {
        if (chrome.runtime?.lastError) {
          throw new Error(`${chrome.runtime?.lastError}`);
        }
        setLoading(false);
        setEnableUI(true);
      })
      .catch((error) => {
        console.error("Query execution error:", error);
        setLoading(false);
        setEnableUI(true);
        setError(error.message);
      });
  }, []);

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
        disabled={!enableUI}
        className="execute-btn"
      >
        {loading ? "Processing..." : "Execute Query"}
      </button>

      {loading && <div className="loading">Loading comments...</div>}
      {error && <div className="error">Error: {error}</div>}
      <div className="comments-controls">
        <label className="comments-counter">
          Comments Loaded: {commentCount.loaded}
        </label>
        <button
          onClick={handleLoadMore}
          disabled={!enableUI}
          className="load-more-btn"
        >
          {loading ? "Processing..." : "Load More"}
        </button>
      </div>
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
                      "../assets/default-avatar.png"
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
                    src="../assets/thumbs-up.png"
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
