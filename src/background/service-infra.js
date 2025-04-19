import initSqlJs from "../lib/sql";

let db = null;

/**
 * Initializes the SQLite database and creates the comments table if it doesn't exist.
 * @returns {Promise<SQL.Database>} The initialized database instance.
 */
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

/**
 * Executes a SQL query within a transaction and sends the results to the Chrome runtime.
 * @param {string} query - The SQL query to execute.
 * @throws Will throw an error if the query is invalid or execution fails.
 */
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
    await chrome.runtime.sendMessage({
      action: "QUERY_RESULT",
      payload: {
        results,
      },
    });
  } catch (error) {
    console.error("Error sending message to runtime:", error);
    throw error;
  }
}

/**
 * Fetches data using the provided fetchData function and inserts it into the comments table.
 * Sends status updates to the Chrome runtime during the process.
 * @param {Function} fetchData - A function that fetches data to be inserted.
 * @param {Object} _dataSchema - (Optional) Schema for data validation (not currently used).
 * @throws Will throw an error if data fetching or insertion fails.
 */
export async function insertData(fetchData, _dataSchema) {
  try {
    await chrome.runtime.sendMessage({
      action: "DATA_FETCH_LOADING",
    });

    if (!fetchData) throw new Error("FetchData function is not set");

    if (!db) {
      try {
        db = await getDatabase();
      } catch (error) {
        console.error("Error initializing database:", error);
        throw error;
      }
    }

    const { items } = await fetchData();

    if (!items || items.length === 0) {
      if (!items) {
        console.log("No items to insert");
      } else if (items.length === 0) {
        console.log("No items found");
      }
      return;
    }

    try {
      db.exec("BEGIN TRANSACTION");
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
      console.error("Comments inserted failed!");
      throw error;
    }

    // Query the total number of items in the database
    let totalInternalItems = 0;
    try {
      const result = db.exec("SELECT COUNT(*) AS total FROM comments");
      totalInternalItems = result[0]?.values[0][0] || 0; // Extract the count value
    } catch (error) {
      console.error("Error querying total items in database:", error);
      throw error;
    }

    await chrome.runtime.sendMessage({
      action: "DATA_FETCH_DONE",
      payload: {
        totalInternalItems,
      },
    });
  } catch (error) {
    console.error("Error in insertData:", error);
    await chrome.runtime.sendMessage({
      action: "DATA_FETCH_ERROR",
    });
    throw error;
  }
}

/**
 * Closes the SQLite database and resets the reference to avoid accidental reuse.
 */
export function closeDatabase() {
  if (db) {
    db.close();
    db = null; // Reset the reference to avoid accidental reuse
    console.log("Database closed successfully.");
  }
}
