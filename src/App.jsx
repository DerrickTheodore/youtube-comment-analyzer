import React, { useState, useEffect, useCallback } from "react";
import SQLEditor from "./components/SQLEditor";

function App() {
  const [query, setQuery] = useState("");
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [enableUI, setEnableUI] = useState(null);

  // Listen for video changes from background script
  useEffect(() => {
    const handleVideoViewed = async (request, sender, sendResponse) => {
      if (request.action === "VIDEO_VIEWED") {
        try {
          const { videoId } = request.payload;
          console.log("App() => Video viewed:", videoId);
          setEnableUI(videoId);
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

  const handleExecuteQuery = async () => {
    setLoading(true);
    setError(null);
    setComments([]);

    try {
      const response = await chrome.runtime.sendMessage({
        action: "EXECUTE_QUERY",
        payload: { query },
      });

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
    } catch (error) {
      console.error("Query execution error:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQueryChange = useCallback((value) => {
    setQuery(value);
  }, []);

  return (
    <div className="container">
      <h1>YouTube Comment Analyzer</h1>
      <SQLEditor onChange={handleQueryChange} />
      <button
        onClick={handleExecuteQuery}
        disabled={!enableUI || loading}
        className="execute-btn"
      >
        {loading ? "Processing..." : "Execute Query"}
      </button>

      {loading && <div className="loading">Loading comments...</div>}
      {error && <div className="error">Error: {error}</div>}

      <div className="comments-container">
        {comments.map((comment) => (
          <div key={comment.id} className="comment-card">
            <h3>{comment.authorDisplayName}</h3>
            <p>{comment.textOriginal}</p>
            <div className="comment-stats">
              <span>👍 {comment.likeCount}</span>
              <span>💬 {comment.totalReplyCount}</span>
              <span>
                📅 {new Date(comment.publishedAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
