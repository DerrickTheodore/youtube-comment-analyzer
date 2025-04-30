import React, { useCallback, useEffect, useState } from "react";
import {
  asyncMessageHandler,
  getMessageTransactionKey,
} from "../../lib/shared-utils";
import SQLEditor from "../components/SQLEditor";

function YouTubeView() {
  const [query, setQuery] = useState(
    "SELECT *\nFROM comments\nORDER BY\nlikeCount DESC,\npublishedAt DESC\nLIMIT 5"
  );
  const [comments, setComments] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [enableUI, setEnableUI] = useState(true);
  const [commentCount, setCommentCount] = useState(0);

  useEffect(() => {
    const handleCommentDataFetchAsync = asyncMessageHandler(
      async (request, _sender) => {
        const { action, payload } = request;
        let transactionKey;

        if (action !== "RESPONSE") return;
        if (
          payload &&
          payload?.request &&
          payload?.request?.action &&
          payload.request.action !== "LOAD_YOUTUBE_VIEW_DATA"
        )
          return;

        transactionKey = await getMessageTransactionKey(payload.request);

        if (
          payload?.transactionKey &&
          payload.transactionKey !== transactionKey
        )
          return;

        console.log(
          `Received action: ${action} with transactionKey: ${transactionKey}`
        );
        console.log("Payload:", JSON.stringify(payload, null, 2));

        if (payload?.status === "LOADING") {
          setLoading(true);
          setEnableUI(false);
        }
        if (payload?.status === "DONE") {
          const {
            data: [comments],
          } = payload;
          setLoading(false);
          setEnableUI(true);
          setComments(comments);
          setCommentCount(comments.length);
        }
        if (payload?.status === "ERROR") {
          setLoading(false);
          setEnableUI(true);
          setError(payload.error);
        }
      }
    );
    const handleQueryResultFetchAsync = asyncMessageHandler(
      async (request, _sender) => {
        const { action, payload } = request;
        let transactionKey;

        if (action !== "RESPONSE") return;
        if (
          payload &&
          payload?.request &&
          payload?.request?.action &&
          payload.request.action !== "EXECUTE_YOUTUBE_COMMENT_DATA_QUERY"
        )
          return;

        transactionKey = await getMessageTransactionKey(payload.request);

        if (
          payload?.transactionKey &&
          payload.transactionKey !== transactionKey
        )
          return;

        console.log(
          `Received action: ${action} with transactionKey: ${transactionKey}`
        );
        console.log("Payload:", JSON.stringify(payload, null, 2));

        if (payload?.status === "LOADING") {
          setLoading(true);
          setEnableUI(false);
        }
        if (payload?.status === "DONE") {
          const {
            data: [comments],
          } = payload;
          setLoading(false);
          setEnableUI(true);
          setComments(comments);
        }
        if (payload?.status === "ERROR") {
          setLoading(false);
          setEnableUI(true);
          setError(payload.error);
        }
      }
    );

    chrome.runtime.onMessage.addListener(handleCommentDataFetchAsync);
    chrome.runtime.onMessage.addListener(handleQueryResultFetchAsync);

    return () => {
      chrome.runtime.onMessage.removeListener(handleCommentDataFetchAsync);
      chrome.runtime.onMessage.removeListener(handleQueryResultFetchAsync);
    };
  }, []);

  useEffect(() => {
    chrome.runtime.sendMessage(
      {
        action: "LOAD_YOUTUBE_VIEW_DATA",
      },
      (response) => {
        if (chrome.runtime?.lastError)
          throw new Error(
            `(YOUTUBE_VIEW) REQUEST["LOAD_YOUTUBE_VIEW_DATA"]:\n${JSON.stringify(
              chrome.runtime?.lastError,
              null,
              2
            )}`
          );
        if (response) {
          console.log(
            `(YOUTUBE_VIEW) REQUEST["LOAD_YOUTUBE_VIEW_DATA"]:\n${JSON.stringify(
              response,
              null,
              2
            )}`
          );
        }
      }
    );
  }, []);

  const handleExecuteQuery = useCallback(async () => {
    chrome.runtime.sendMessage(
      {
        action: "EXECUTE_YOUTUBE_COMMENT_DATA_QUERY",
        payload: { query },
      },
      () => {
        if (chrome.runtime?.lastError)
          throw new Error(
            `"EXECUTE_YOUTUBE_COMMENT_DATA_QUERY":\n${JSON.stringify(
              chrome.runtime?.lastError,
              null,
              2
            )}`
          );
      }
    );
  }, [query]);

  const handleLoadMore = useCallback(async () => {
    chrome.runtime.sendMessage(
      {
        action: "LOAD_YOUTUBE_VIDEO_COMMENT_DATA",
      },
      () => {
        if (chrome.runtime?.lastError)
          throw new Error(
            `"LOAD_YOUTUBE_VIDEO_COMMENT_DATA":\n${JSON.stringify(
              chrome.runtime?.lastError,
              null,
              2
            )}`
          );
      }
    );
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
          Comments Loaded: {commentCount}
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
        {!comments ? (
          <div className="no-comments">No comments available.</div>
        ) : (
          comments.map((comment) => (
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
          ))
        )}
      </div>
    </div>
  );
}

export default YouTubeView;
