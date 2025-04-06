import initSqlJs from "sql.js";

// Database and state management
let db = null;
let isInitialized = false;

// Request queue management
let isProcessing = false;
let pendingRequest = null;
const PROCESSING_TIMEOUT = 30000; // 30 seconds timeout

// Event listeners
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error("Setting panel behavior", error));

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab?.url) {
      await setSidePanelEnabled(tabId, tab.url);
      const storedTabOpenKey = tabId.toString();
      const storedTabOpenHash = await chrome.storage.local.get(
        storedTabOpenKey
      );
      const isTabOpen = storedTabOpenHash[storedTabOpenKey];
      const sidePanel = await chrome.sidePanel.getOptions({ tabId });

      if (sidePanel.enabled && !isTabOpen) {
        await chrome.tabs.sendMessage(tabId, {
          action: "OPEN_SIDE_PANEL",
          payload: { tabId: tabId },
        });
      } else if (!sidePanel.enabled && isTabOpen) {
        await chrome.tabs.sendMessage(tabId, {
          action: "CLOSE_SIDE_PANEL",
        });
      }
    }
  } catch (error) {
    console.error("Handling tab activation", error);
  } finally {
    console.log("Completed tab activation handling for tabId:", tabId);
  }
});

chrome.tabs.onCreated.addListener(async (tab) => {
  try {
    if (tab?.url) {
      const tabId = tab.id;
      await setSidePanelEnabled(tabId, tab.url);
      const storedTabOpenKey = tabId.toString();
      const storedTabOpenHash = await chrome.storage.local.get(
        storedTabOpenKey
      );
      const isTabOpen = storedTabOpenHash[storedTabOpenKey];
      const sidePanel = await chrome.sidePanel.getOptions({ tabId });

      if (sidePanel.enabled && !isTabOpen) {
        await chrome.tabs.sendMessage(tabId, {
          action: "OPEN_SIDE_PANEL",
          payload: { tabId: tabId },
        });
      } else if (!sidePanel.enabled && isTabOpen) {
        await chrome.tabs.sendMessage(tabId, {
          action: "CLOSE_SIDE_PANEL",
        });
      }
    }
  } catch (error) {
    console.error("Handling tab creation", error);
  } finally {
    console.log("Completed tab creation handling for tabId:", tab.id);
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  try {
    if (tab?.url) {
      await setSidePanelEnabled(tabId, tab.url);
      const storedTabOpenKey = tabId.toString();
      const storedTabOpenHash = await chrome.storage.local.get(
        storedTabOpenKey
      );
      const isTabOpen = storedTabOpenHash[storedTabOpenKey];
      const sidePanel = await chrome.sidePanel.getOptions({ tabId });

      if (sidePanel.enabled && !isTabOpen) {
        const videoId = new URL(tab.url).searchParams.get("v");

        await chrome.tabs.sendMessage(tabId, {
          action: "OPEN_SIDE_PANEL",
          payload: { tabId: tabId },
        });

        if (changeInfo?.url === undefined) return;

        const currentVideoId = new URL(changeInfo.url).searchParams.get("v");

        if (videoId && currentVideoId && videoId !== currentVideoId) {
          await ensureDatabaseInitialized();
          // TODO: Uncomment the following line to fetch comments
          // await fetchComments(currentVideoId);
          console.log(
            "await fetchComments(currentVideoId); would be called here"
          );

          await chrome.tabs.sendMessage(tabId, {
            action: "VIDEO_VIEWED",
            payload: { videoId, timestamp: Date.now() },
          });
        }
      } else if (!sidePanel.enabled && isTabOpen) {
        await chrome.tabs.sendMessage(tabId, {
          action: "CLOSE_SIDE_PANEL",
        });
      }
    }
  } catch (error) {
    console.error("Handling tab update", error);
  } finally {
    console.log("Completed tab creation handling for tabId:", tab.id);
  }
});
chrome.tabs.onRemoved.addListener(async (tabId) => {
  try {
    const storedTabOpenKey = tabId.toString();
    const storedTabOpenHash = await chrome.storage.local.get(storedTabOpenKey);
    const isStoredTabOpen =
      typeof storedTabOpenHash[storedTabOpenKey] === Boolean.name.toLowerCase();

    if (isStoredTabOpen) await chrome.storage.local.remove(storedTabOpenKey);
  } catch (error) {
    console.error("Handling tab update", error);
  } finally {
    console.log("Completed tab removed handling for tabId:", tabId);
  }
});

chrome.runtime.onInstalled.addListener(async () => {
  try {
    await ensureDatabaseInitialized();
  } catch (error) {
    console.error(`Database failed:, ${error}`);
  } finally {
    console.log("Completed onInstalled event");
  }
});

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (
    ["EXECUTE_QUERY", "POPUP_OPENED", "POPUP_CLOSED"].includes(request.action)
  ) {
    if (isProcessing) {
      if (pendingRequest) clearTimeout(pendingRequest.timer);
      pendingRequest = { request, sendResponse };
      return true;
    }
    isProcessing = true;
    handleRequest(request, sendResponse);
    return true;
  }
  return false;
});

// Helper to initialize the database if not already initialized
async function ensureDatabaseInitialized() {
  console.log("Ensuring database is initialized");
  if (isInitialized) return;
  await initDatabase();
}

// Initialize SQLite database
async function initDatabase() {
  try {
    if (isInitialized) {
      console.log("Database already initialized");
      return true;
    }

    // Resolve the correct wasm file path using chrome.runtime.getURL
    const wasmUrl = chrome.runtime.getURL("sql-wasm.wasm");

    const SQL = await initSqlJs({
      locateFile: (file) => {
        if (file === "sql-wasm.wasm") {
          return wasmUrl;
        }
        return file;
      },
    });

    db = new SQL.Database();
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
  } catch (error) {
    console.error("Database initialization", error);
    throw error;
  }
}

// Fetch comments from YouTube API
async function fetchComments(videoId) {
  try {
    if (!videoId) throw new Error("Video ID not set");
    await ensureDatabaseInitialized();

    const apiKey = process.env.YOUTUBE_API_KEY;
    const url = `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&part=replies&videoId=${videoId}&key=${apiKey}&maxResults=100`;

    const response = await fetch(url);
    if (!response.ok)
      throw new Error(`API request failed: ${response.statusText}`);

    const data = await response.json();
    insertComments(data.items);
    return { success: true, count: data.items.length };
  } catch (error) {
    console.error("Fetching comments", error);
    return { success: false, error: error.message };
  }
}

// Insert comments into the database
function insertComments(items) {
  db.exec("BEGIN TRANSACTION");
  try {
    items.forEach((item) => {
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
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
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
    console.error("Query execution", error);
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
        sendResponse({ status: "SUCCESS", results });
        break;

      case "POPUP_OPENED":
        await handlePopupOpened(sendResponse);
        break;

      case "POPUP_CLOSED":
        sendResponse({ status: "SUCCESS" });
        break;

      case "OPEN_SIDE_PANEL":
        chrome.sidePanel.open({ tabId: payload.tabId });
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error(`Handling action ${action}`, error);
    sendResponse({ status: "ERROR", error: error.message, action });
  } finally {
    clearTimeout(timer);
    processPending();
    return true; // Keep the message channel open for sendResponse
  }
}

// Handle popup opened action
async function handlePopupOpened(sendResponse) {
  try {
    chrome.tabs.query({ active: true, currentWindow: true }, async ([tab]) => {
      const tabId = tab.id;
      const storedTabOpenKey = tabId.toString();
      const storedTabOpenHash = await chrome.storage.local.get(
        storedTabOpenKey
      );
      const isTabOpen = storedTabOpenHash[storedTabOpenKey];

      if (
        tab.active &&
        tab.url.startsWith("https://www.youtube.com/watch") &&
        !isTabOpen
      ) {
        const videoId = new URL(tab.url).searchParams.get("v");
        if (videoId) {
          await ensureDatabaseInitialized();
          // TODO: Uncomment the following line to fetch comments
          // await fetchComments(currentVideoId);
          console.log(
            "await fetchComments(currentVideoId); would be called here"
          );
        }

        await chrome.tabs.sendMessage(tabId, {
          action: "VIDEO_VIEWED",
          payload: { videoId, timestamp: Date.now() },
        });
      }
      sendResponse({ status: "SUCCESS" });
    });
  } catch (error) {
    console.error("handlePopupOpened: ", error);
  } finally {
    console.log("handlePopupOpened completed");
  }
}

async function setSidePanelEnabled(tabId, url) {
  if (!tabId || !url) throw new Error(`Invalid tabId: ${tabId} or URL: ${url}`);

  try {
    const tabSidePanel = await chrome.sidePanel.getOptions({ tabId });
    const storedTabOpenKey = tabId.toString();
    const storedTabOpenHash = await chrome.storage.local.get(storedTabOpenKey);
    const isSidePanelEnabledOptionSet = tabSidePanel?.enabled !== undefined;
    const isTabOpenSet = storedTabOpenHash[storedTabOpenKey] !== undefined;
    const shouldTabSidePanelBeEnabled = url.startsWith(
      "https://www.youtube.com/watch"
    );

    console.log(
      `BEFORE (Set): Content of chrome.storage.local:\n${JSON.stringify(
        await chrome.storage.local.get(null),
        null,
        2
      )}`
    );

    if (!isSidePanelEnabledOptionSet && !isTabOpenSet) {
      console.log(
        `Setting side panel for tabId: ${tabId} if shouldTabSidePanelBeEnabled is ${shouldTabSidePanelBeEnabled}`
      );
      if (shouldTabSidePanelBeEnabled) {
        await chrome.sidePanel.setOptions({
          tabId,
          path: "sidepanel.html",
          enabled: true,
        });
      } else {
        await chrome.sidePanel.setOptions({
          tabId,
          enabled: false,
        });
      }

      console.log(
        `Setting storage for tabId: ${storedTabOpenKey} if shouldTabSidePanelBeEnabled is ${shouldTabSidePanelBeEnabled}`
      );

      if (shouldTabSidePanelBeEnabled) {
        await chrome.storage.local.set({
          [storedTabOpenKey]: true,
        });
      } else {
        await chrome.storage.local.set({
          [storedTabOpenKey]: false,
        });
      }

      console.log(
        `[EARLY RETURN HIT POINT] AFTER (Set): Content of chrome.storage.local:\n${JSON.stringify(
          await chrome.storage.local.get(null),
          null,
          2
        )}`
      );
      return;
    }

    console.log(
      `BEFORE (Update): Content of chrome.storage.local:\n${JSON.stringify(
        await chrome.storage.local.get(null),
        null,
        2
      )}`
    );

    if (shouldTabSidePanelBeEnabled && !tabSidePanel.enabled) {
      console.log(
        `Enabling side panel for tabId: ${tabId} if ${shouldTabSidePanelBeEnabled}`
      );
      await chrome.sidePanel.setOptions({
        tabId,
        path: "sidepanel.html",
        enabled: true,
      });
      await chrome.storage.local.set({
        [storedTabOpenKey]: true,
      });
    } else if (!shouldTabSidePanelBeEnabled && tabSidePanel.enabled) {
      console.log(
        `Disabling side panel for tabId: ${tabId} if ${shouldTabSidePanelBeEnabled}`
      );
      await chrome.sidePanel.setOptions({
        tabId,
        enabled: false,
      });
      await chrome.storage.local.set({
        [storedTabOpenKey]: false,
      });
    }
    console.log(
      `AFTER (Update): Content of chrome.storage.local:\n${JSON.stringify(
        await chrome.storage.local.get(null),
        null,
        2
      )}`
    );
  } catch (error) {
    console.error("Updating side panel visibility", error);
  }
}
