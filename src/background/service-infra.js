import initSqlJs from "../lib/sql";

let db = null;

async function getDatabase() {
  if (!db) {
    const SQL = await initSqlJs({
      locateFile: (file) => `../lib/${file}`,
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
  }
  return db;
}

export async function executeQuery(query) {
  let results = [];
  if (!query) throw new Error("Query is not set");
  if (query.trim().length === 0) throw new Error("Query cannot be empty");

  if (!db) {
    try {
      db = await getDatabase();
    } catch (error) {
      console.error("Error initializing database:", error);
      throw error;
    }
  }

  try {
    db.exec("BEGIN TRANSACTION");
    results = db.exec(query);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    console.error("Error executing query:", error);
    throw error;
  }

  try {
    results = results.map((result) => ({
      columns: result.columns,
      values: result?.values,
    }));
  } catch (error) {
    console.error("Error processing results:", error);
    throw error;
  }

  try {
    const [{ id: tabId }] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    await chrome.runtime.sendMessage({
      action: "QUERY_RESULT",
      payload: {
        tabId,
        results,
      },
    });
  } catch (error) {
    console.error("Error sending message to runtime:", error);
    throw error;
  }
}
export async function insertData({ fetchData, _dataSchema }) {
  chrome.tabs.query(
    { active: true, currentWindow: true },
    async function (tabs) {
      if (tabs && tabs.length > 0) {
        const currentTabId = tabs[0].id;
        const tabsDataFetchKey = currentTabId.toString();
        const storageHash = await chrome.storage.local.get("tabsDataFetch");

        chrome.storage.local.set({
          tabsDataFetch: {
            ...(storageHash["tabsDataFetch"] || {}),
            [tabsDataFetchKey]: "loading",
          },
        });

        let items = [];

        if (!fetchData) throw new Error("FetchData function is not set");

        if (!db) {
          try {
            db = await getDatabase();
          } catch (error) {
            console.error("Error initializing database:", error);
            throw error;
          }
        }

        try {
          items = await fetchData();
        } catch (error) {
          console.error("Error fetching data:", error);
          throw error;
        }

        if (!items || items.length === 0) {
          if (!items) {
            console.log("No items to insert");
          } else if (items.length === 0) {
            console.log("No items found");
          }
          return;
        }

        try {
          console.log("Inserting comments into the database...");
          console.log("Transaction initiated.");
          db.exec("BEGIN TRANSACTION");
          items.forEach((item) => {
            const comment = {
              ...item.snippet.topLevelComment.snippet,
              id: item.id,
              totalReplyCount: item.snippet.totalReplyCount,
            };
            db.run(
              `INSERT OR IGNORE INTO comments VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                comment.id,
                comment.authorDisplayName,
                comment.textOriginal,
                comment.likeCount,
                comment.totalReplyCount,
                comment.publishedAt,
                comment.authorProfileImageUrl,
              ]
            );
          });
          db.exec("COMMIT");
          console.log("Comments inserted successfully!");
        } catch (error) {
          db.exec("ROLLBACK");
          console.error("Comments inserted failed!");
          throw error;
        } finally {
          console.log("Transaction completed.");
        }

        chrome.storage.local.set({
          tabsDataFetch: {
            ...(storageHash["tabsDataFetch"] || {}),
            [tabsDataFetchKey]: "done",
          },
        });
      }
    }
  );
}
