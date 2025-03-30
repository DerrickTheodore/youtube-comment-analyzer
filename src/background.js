import initSqlJs from "sql.js";

// Database and state management
let db = null;
let currentVideoId = null;
let isInitialized = false;

// Request queue management
let isProcessing = false;
let pendingRequest = null;
const PROCESSING_TIMEOUT = 30000; // 30 seconds timeout

// Initialize SQLite database
async function initDatabase() {
  try {
    if (isInitialized) return true;

    const SQL = await initSqlJs({
      locateFile: (file) => chrome.runtime.getURL(file),
    });

    db = new SQL.Database();

    // Create comments table
    db.run(`
      CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY,
        authorDisplayName TEXT,
        textOriginal TEXT,
        likeCount INTEGER,
        totalReplyCount INTEGER,
        publishedAt TEXT,
        authorProfileImageUrl TEXT
      );
    `);

    isInitialized = true;
    console.log("Database initialized successfully");
    return true;
  } catch (error) {
    console.error("Database initialization failed:", error);
    throw error;
  }
}

// Fetch comments from YouTube API
async function fetchComments(videoId) {
  try {
    if (!videoId) throw new Error("Video ID not set");
    if (!isInitialized) throw new Error("Database not initialized");

    const apiKey = process.env.YOUTUBE_API_KEY;
    const url = `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&part=replies&videoId=${videoId}&key=${apiKey}&maxResults=100`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const data = await response.json();
    const preInsertCommentCount = db.exec("SELECT COUNT(id) FROM comments");
    console.log(
      `Comment count before insert: ${preInsertCommentCount[0].values[0][0]}`
    );

    // Begin transaction for batch insert
    db.exec("BEGIN TRANSACTION");

    try {
      data.items.forEach((item) => {
        const comment = {
          ...item.snippet.topLevelComment.snippet,
          id: item.id,
          totalReplyCount: item.snippet.totalReplyCount,
        };

        db.run(`INSERT OR IGNORE INTO comments VALUES (?, ?, ?, ?, ?, ?, ?)`, [
          comment.id,
          comment.authorDisplayName,
          comment.textOriginal,
          comment.likeCount,
          comment.totalReplyCount,
          comment.publishedAt,
          comment.authorProfileImageUrl,
        ]);
      });

      db.exec("COMMIT");
      const postInsertCommentCount = db.exec("SELECT COUNT(id) FROM comments");
      console.log(
        `Comment count after insert: ${postInsertCommentCount[0].values[0][0]}`
      );
      console.log(`Inserted ${data.items.length} comments`);
      return { success: true, count: data.items.length };
    } catch (insertError) {
      db.exec("ROLLBACK");
      throw insertError;
    }
  } catch (error) {
    console.error("Failed to fetch comments:", error);
    return { success: false, error: error.message };
  }
}

function executeQuery(query) {
  if (!isInitialized) throw new Error("Database not initialized");
  if (!query || typeof query !== "string") throw new Error("Invalid query");

  try {
    const results = db.exec(query);
    return results.map((result) => ({
      columns: result.columns,
      values: result.values,
    }));
  } catch (error) {
    console.error("Query execution failed:", error);
    throw error;
  }
}

function processPending() {
  if (pendingRequest) {
    const { request, sendResponse, timer } = pendingRequest;
    clearTimeout(timer);
    pendingRequest = null;
    handleRequest(request, sendResponse);
  } else {
    isProcessing = false;
  }
}

// Main request handler
async function handleRequest(request, sendResponse) {
  const { action, payload } = request;
  const timer = setTimeout(() => {
    sendResponse({ status: "TIMEOUT" });
    isProcessing = false;
    processPending();
  }, PROCESSING_TIMEOUT);

  try {
    switch (action) {
      case "EXECUTE_QUERY":
        if (!payload?.query) throw new Error("No query provided");
        const results = executeQuery(payload.query);
        clearTimeout(timer);
        sendResponse({ status: "SUCCESS", results });
        break;

      case "POPUP_OPENED":
        console.log("Popup opened");
        chrome.tabs.query(
          { active: true, currentWindow: true },
          async ([tab]) => {
            try {
              if (tab.active && tab.url.includes("youtube.com/watch")) {
                const url = new URL(tab.url);
                const videoId = url.searchParams.get("v");

                if (videoId && videoId !== currentVideoId) {
                  currentVideoId = videoId;

                  if (!isInitialized) {
                    await initDatabase();
                  }
                  await fetchComments(currentVideoId);
                }

                chrome.runtime.sendMessage({
                  action: "VIDEO_VIEWED",
                  payload: { videoId, timestamp: Date.now() },
                });
              }
            } catch (error) {
              console.error("Error handling tab update:", error);
            }
          }
        );
        clearTimeout(timer);
        sendResponse({ status: "SUCCESS" });
        break;

      case "POPUP_CLOSED":
        console.log("Popup closed");
        clearTimeout(timer);
        sendResponse({ status: "SUCCESS" });
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error(`Error handling ${action}:`, error);
    clearTimeout(timer);
    sendResponse({
      status: "ERROR",
      error: error.message,
      action: action,
    });
  } finally {
    processPending();
  }
}

// Message listener with request queueing
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (
    request.action === "EXECUTE_QUERY" ||
    request.action === "POPUP_OPENED" ||
    request.action === "POPUP_CLOSED"
  ) {
    if (isProcessing) {
      // Cancel previous pending request if exists
      if (pendingRequest) {
        clearTimeout(pendingRequest.timer);
      }
      // Queue the latest request
      pendingRequest = { request, sendResponse };
      return true;
    }

    isProcessing = true;
    handleRequest(request, sendResponse);
    return true;
  }
  return false;
});

// Tab monitoring (independent of request queue)
chrome.tabs.onUpdated.addListener(async (_tabId, _changeInfo, tab) => {
  if (tab.active && tab.url.includes("youtube.com/watch")) {
    try {
      const url = new URL(tab.url);
      const videoId = url.searchParams.get("v");

      if (videoId && videoId !== currentVideoId) {
        currentVideoId = videoId;

        if (!isInitialized) {
          await initDatabase();
        }

        await fetchComments(currentVideoId);

        chrome.runtime.sendMessage({
          action: "VIDEO_VIEWED",
          payload: { videoId, timestamp: Date.now() },
        });
      }
    } catch (error) {
      console.error("Error handling tab update:", error);
    }
  }
});

// Initialization
(async function initialize() {
  try {
    console.log("Background initialized successfully");
    if (!isInitialized) await initDatabase();
  } catch (error) {
    console.error("Background initialization failed:", error);
  }
})();
