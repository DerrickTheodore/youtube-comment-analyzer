import React, { useState, useEffect } from "react";
import initSqlJs from "sql.js";

// Load environment variables from .env file
// dotenv.config();

function App() {
  const [query, setQuery] = useState("");
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [db, setDb] = useState(null);
  const [videoId, setVideoId] = useState(null);

  // Get the videoId from the background script - this is a one-time operation TODO: What happens if the videoId changes?
  useEffect(() => {
    chrome.runtime.sendMessage({ action: "getVideoId" }, (response) => {
      if (response.error) {
        setError(response.error);
      } else {
        setVideoId(response.videoId);
      }
    });
  }, []);

  // Initialize the database, create the table, and insert data when the component mounts
  useEffect(() => {
    const initDatabase = async () => {
      if (!videoId) return; // Wait for the videoId to be set
      try {
        // Initialize SQLite database
        const SQL = await initSqlJs({
          locateFile: (file) => `./${file}`,
        });
        const database = new SQL.Database();
        setDb(database);

        // Create the comments table
        database.run(`
          CREATE TABLE IF NOT EXISTS comments (
            id TEXT PRIMARY KEY,
            authorDisplayName TEXT,
            textOriginal TEXT,
            likeCount INTEGER,
            totalReplyCount INTEGER,
            publishedAt TEXT
          );
        `);

        // Fetch comments from the YouTube API
        const apiKey = process.env.YOUTUBE_API_KEY; // Use the API key from .env
        const url = `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${videoId}&key=${apiKey}&maxResults=100`;

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`API request failed: ${response.statusText}`);
        }
        const data = await response.json();

        // Log the fetched comments for debugging
        // console.log("Fetched comments:", data.items);

        // Insert comments into the database
        data.items.forEach((item) => {
          const comment = {
            ...item.snippet.topLevelComment.snippet,
            id: item.id,
            totalReplyCount: item.snippet.totalReplyCount,
          };

          // Log each comment for debugging
          // console.log("Inserting comment:", comment);

          database.run(
            `INSERT OR IGNORE INTO comments (id, authorDisplayName, textOriginal, likeCount, totalReplyCount, publishedAt)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              comment.id,
              comment.authorDisplayName,
              comment.textOriginal,
              comment.likeCount,
              comment.totalReplyCount,
              comment.publishedAt,
            ]
          );
        });

        console.log("Database initialized and data inserted.");
      } catch (error) {
        console.error("Error initializing database:", error);
        setError(error.message);
      }
    };

    initDatabase();
  }, [videoId]); // Run only once when the component mounts

  // Handle the "Execute Query" button click
  const handleExecuteQuery = () => {
    const transformCommentsForDisplay = ({ columns, values }) => {
      return values.map((row) => {
        return columns.reduce((acc, col, i) => {
          acc[col] = row[i];
          return acc;
        }, {});
      });
    };
    if (!db) {
      setError("Database not initialized.");
      return;
    }

    console.log("Loading set to true");
    setLoading(true);
    console.log("Error set to null");
    setError(null);
    console.log("Comments set to empty array");
    setComments([]);

    try {
      // Execute the user's query against the database
      console.log(`Executing query: ${query}`);
      const results = db.exec(query);
      if (results.length > 0) {
        console.log(
          `Setting comments to results with ${results[0].values.length} rows`
        );
        setComments(results.flatMap(transformCommentsForDisplay));
      } else {
        console.log("Comments set to empty array");
        setComments([]);
      }
    } catch (error) {
      console.error("Error executing query:", error);
      setError(error.message);
    } finally {
      console.log("Loading set to false");
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>YouTube Comment Analyzer</h1>
      <textarea
        id="query"
        placeholder="Enter SQL query (e.g., SELECT * FROM comments WHERE likeCount > 10)"
        value={query}
        onChange={(e) => {
          const value = e.target.value;
          console.log("Setting query to", value);

          setQuery(e.target.value);
        }}
      />
      <button id="executeButton" onClick={handleExecuteQuery}>
        Execute Query
      </button>
      {loading && <div id="loading">Loading comments...</div>}
      {error && <div id="error">Error: {error}</div>}
      {!loading && !error && (
        <div id="comments">
          {comments.map(
            ({
              id,
              authorDisplayName,
              textOriginal,
              likeCount,
              totalReplyCount,
              publishedAt,
            }) => (
              <div key={id} className="comment">
                <strong>{authorDisplayName}</strong>
                <br />
                {textOriginal}
                <br />
                Likes: {likeCount}, Replies: {totalReplyCount}
                <br />
                <small>{publishedAt}</small>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

export default App;
