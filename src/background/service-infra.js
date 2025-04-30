import initSqlJs from "../lib/sql";

// @ts-ignore
// Parcel handles process.env variables by inlining them during the build process,
// making them directly available in the browser environment.
let LOG_SQL_STATEMENTS = process.env.LOG_SQL_STATEMENTS;

if (LOG_SQL_STATEMENTS === undefined) {
  console.warn("Debeloper SQL logging is not set, defaulting to false");
  LOG_SQL_STATEMENTS = false;
}
if (LOG_SQL_STATEMENTS === "true") {
  console.warn("Debeloper SQL logging is set to true");
}
if (LOG_SQL_STATEMENTS === "false") {
  console.warn("Debeloper SQL logging is set to false");
}
if (LOG_SQL_STATEMENTS !== "true" && LOG_SQL_STATEMENTS !== "false") {
  throw new Error(
    "Debeloper SQL logging is not a boolean, must be true or false"
  );
}

function logSql(statement, params = []) {
  if (LOG_SQL_STATEMENTS === "true") {
    console.log("Executing SQL:", statement);
    if (params.length > 0) {
      console.log("With parameters:", JSON.stringify(params, null, 2));
    }
  }
}

function execWithLogging(db, statement, params = []) {
  logSql(statement, params);
  return db.exec(statement, params);
}

function runWithLogging(db, statement, params = []) {
  logSql(statement, params);
  return db.run(statement, params);
}

const databaseManager = (() => {
  let dbPromise = null; // Cached promise for the database instance

  const initialize = async () => {
    try {
      console.log("Initializing SQL.js...");
      const SQL = await initSqlJs({
        locateFile: (file) => `../lib/${file}`,
      });
      const db = new SQL.Database();
      console.log("Database initialized successfully.");
      return db;
    } catch (error) {
      console.error("Database initialization failed:", error);
      dbPromise = null; // Reset promise on failure to allow retry
      throw error;
    }
  };

  const get = async () => {
    if (!dbPromise) {
      console.log("No cached database promise found, initializing...");
      dbPromise = initialize();
    } else {
      console.log("Returning cached database promise.");
    }
    // Return the promise. If initialization failed previously, it might reject.
    // If successful, it resolves to the db instance.
    return dbPromise;
  };

  const close = async () => {
    if (!dbPromise) {
      console.log(
        "Database not initialized or already closed, nothing to close."
      );
      return;
    }
    try {
      // Await the promise to ensure initialization is complete (or failed)
      const db = await dbPromise;
      db.close();
      dbPromise = null; // Reset the cache
      console.log("Database closed successfully and cache reset.");
    } catch (error) {
      // This catches errors during initialization (if close is called before init finishes)
      // or errors during db.close() itself.
      console.error("Error closing database:", error);
      // Reset promise even if closing failed, to allow re-initialization attempt
      dbPromise = null;
    }
  };

  return { getDatabase: get, closeDatabase: close };
})();

export function createScopeQuery(query, dataSchema, scopingRow) {
  return `
    SELECT scoped.*
    FROM (
      ${query.replace(
        new RegExp(`FROM\\s+${dataSchema.tableName}`, "i"),
        `FROM (
          SELECT * FROM ${dataSchema.tableName} WHERE ${dataSchema.tableName}.${
          dataSchema.scopingTable.foreignKey
        } = '${scopingRow[dataSchema.scopingTable.primaryKey]}'
         ) scoped_source`
      )}
    ) AS scoped `;
}

export async function executeQuery(query) {
  let results;
  const db = await databaseManager.getDatabase();

  try {
    execWithLogging(db, "BEGIN TRANSACTION");
    results = execWithLogging(db, query);
    execWithLogging(db, "COMMIT");
  } catch (error) {
    execWithLogging(db, "ROLLBACK");
    console.error("Error executing query:", error);
    throw error;
  }

  return results;
}

function createTableQuery(dataSchema) {
  const columns = Object.entries(dataSchema.schema)
    .map(([name, type]) => `${name} ${type}`)
    .join(", ");
  return `CREATE TABLE IF NOT EXISTS ${dataSchema.tableName} (${columns})`;
}

function createInsertQuery(dataSchema) {
  const placeholders = dataSchema.columns.map(() => "?").join(", ");
  return `INSERT OR IGNORE INTO ${
    dataSchema.tableName
  } (${dataSchema.columns.join(", ")}) VALUES (${placeholders})`;
}

export async function runInsertQuery(data, dataSchema) {
  const dataRows = [data].flat();
  const db = await databaseManager.getDatabase();

  try {
    runWithLogging(db, createTableQuery(dataSchema));

    execWithLogging(db, "BEGIN TRANSACTION");
    const insertQuery = createInsertQuery(dataSchema);
    for (const dataRow of dataRows) {
      runWithLogging(
        db,
        insertQuery,
        dataSchema.columns.map((col) => dataRow[col])
      );
    }
    execWithLogging(db, "COMMIT");
  } catch (error) {
    execWithLogging(db, "ROLLBACK");
  }
}

export function parseQueryResults(results) {
  if (results.length === 0) return [];
  const { columns, values: rows } = results[0];
  return rows.map((row) =>
    columns.reduce((rowObject, col, index) => {
      rowObject[col] = row[index];
      return rowObject;
    }, {})
  );
}

export const closeDatabase = databaseManager.closeDatabase;
