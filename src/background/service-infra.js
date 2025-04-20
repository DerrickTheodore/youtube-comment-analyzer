import initSqlJs from "../lib/sql";

let db = null;
// @ts-ignore
// Parcel handles process.env variables by inlining them during the build process,
// making them directly available in the browser environment.
const LOG_SQL_STATEMENTS = process.env.LOG_SQL_STATEMENTS;

/**
 * Logs SQL statements and their parameters if logging is enabled.
 *
 * @param {string} statement - The SQL statement to log.
 * @param {Array} [params=[]] - The parameters for the SQL statement.
 */
function logSql(statement, params = []) {
  if (LOG_SQL_STATEMENTS === "true") {
    console.log("Executing SQL:", statement);
    if (params.length > 0) {
      console.log("With parameters:", params);
    }
  }
}

/**
 * Executes a SQL statement with logging.
 *
 * @param {Object} db - The database instance.
 * @param {string} statement - The SQL statement to execute.
 * @param {Array} [params=[]] - The parameters for the SQL statement.
 * @returns {Object} - The result of the SQL execution.
 */
function execWithLogging(db, statement, params = []) {
  logSql(statement, params);
  return db.exec(statement, params);
}

/**
 * Runs a SQL statement with logging.
 *
 * @param {Object} db - The database instance.
 * @param {string} statement - The SQL statement to run.
 * @param {Array} [params=[]] - The parameters for the SQL statement.
 * @returns {Object} - The result of the SQL execution.
 */
function runWithLogging(db, statement, params = []) {
  logSql(statement, params);
  return db.run(statement, params);
}

/**
 * Initializes the SQLite database.
 * @returns {Promise<SQL.Database>} The initialized database instance.
 */
async function getDatabase() {
  if (!db) {
    const SQL = await initSqlJs({
      locateFile: (file) => `../lib/${file}`,
    });
    db = new SQL.Database();
  }
  return db;
}

function createTableQuery(db, tableName, schema) {
  const columns = Object.entries(schema)
    .map(([name, type]) => `${name} ${type}`)
    .join(", ");
  return `CREATE TABLE IF NOT EXISTS ${tableName} (${columns})`;
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
    execWithLogging(db, "BEGIN TRANSACTION");
    results = execWithLogging(db, query);
    execWithLogging(db, "COMMIT");
  } catch (error) {
    execWithLogging(db, "ROLLBACK");
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
 * Fetches data using the provided fetchData function and inserts it into the data model's table.
 * Sends status updates to the Chrome runtime during the process.
 * @param {Function} fetchData - A function that fetches data to be inserted.
 * @param {Object} dataModel - Fetched data schema.
 * @throws Will throw an error if data fetching or insertion fails.
 */
export async function insertData(fetchData, dataModel) {
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
      runWithLogging(
        db,
        createTableQuery(db, dataModel.tableName, dataModel.schema)
      );
      execWithLogging(db, "BEGIN TRANSACTION");
      items.forEach((item) => {
        runWithLogging(
          db,
          `INSERT OR IGNORE INTO ${
            dataModel.tableName
          } VALUES (${dataModel.columns.map(() => "?").join(", ")})`,
          dataModel.columns.map((col) => item[col])
        );
      });
      execWithLogging(db, "COMMIT");
    } catch (error) {
      execWithLogging(db, "ROLLBACK");
      console.error("Data inserted failed!");
      throw error;
    }

    // Query the total number of items in the database
    let totalInternalItems = 0;
    try {
      const result = execWithLogging(
        db,
        `SELECT COUNT(*) AS total FROM ${dataModel.tableName}`
      );
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
