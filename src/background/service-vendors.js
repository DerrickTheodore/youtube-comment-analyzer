import mockComments from "../../mocks/mockComments.js";
import { mockFetch } from "../../mocks/mockFetch";
// Parcel handles process.env variables by inlining them during the build process,
// making them directly available in the browser environment.
// @ts-ignore
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
// @ts-ignore
let YOUTUBE_MAX_RESULTS = process.env.YOUTUBE_MAX_RESULTS;

// @ts-ignore
let MOCK_YOUTUBE_API_REQUEST = process.env.MOCK_YOUTUBE_API_REQUEST;

if (!YOUTUBE_API_KEY) {
  throw new Error("YouTube API key is not set");
}

if (YOUTUBE_MAX_RESULTS === undefined) {
  console.warn("YouTube max results is not set, defaulting to 10");
  YOUTUBE_MAX_RESULTS = 10;
}

if (!Number.parseInt(YOUTUBE_MAX_RESULTS)) {
  throw new Error("YouTube max results is not a number");
} else if (YOUTUBE_MAX_RESULTS < 1) {
  throw new Error("YouTube max results must be greater than 0");
} else if (YOUTUBE_MAX_RESULTS > 100) {
  throw new Error("YouTube max results must be less than 100");
} else {
  console.warn(
    `YouTube max results is set to ${YOUTUBE_MAX_RESULTS}, limiting results from "/v3/commentThreads" requests to ${YOUTUBE_MAX_RESULTS} items`
  );
}

if (MOCK_YOUTUBE_API_REQUEST === undefined) {
  MOCK_YOUTUBE_API_REQUEST = "false";
  console.warn(
    "YouTube mock vendor API request is not set, defaulting to false"
  );
}
if (MOCK_YOUTUBE_API_REQUEST === "true") {
  MOCK_YOUTUBE_API_REQUEST = true;
  console.warn(
    "YouTube mock vendor API request is set to true, using mock data"
  );
}
if (MOCK_YOUTUBE_API_REQUEST === "false") {
  MOCK_YOUTUBE_API_REQUEST = false;
  console.warn(
    "YouTube mock vendor API request is set to false, using real data"
  );
}

if (MOCK_YOUTUBE_API_REQUEST !== true && MOCK_YOUTUBE_API_REQUEST !== false) {
  throw new Error(
    "YouTube mock vendor API request is not a boolean, must be true or false"
  );
}

const YOUTUBE = "YOUTUBE";

const youtubeCommentsSchema = {
  schema: {
    id: "TEXT PRIMARY KEY",
    authorDisplayName: "TEXT",
    textOriginal: "TEXT",
    likeCount: "INTEGER",
    totalReplyCount: "INTEGER",
    publishedAt: "TEXT",
    authorProfileImageUrl: "TEXT",
    videoId: "TEXT",
  },
  columns: [
    "id",
    "authorDisplayName",
    "textOriginal",
    "likeCount",
    "totalReplyCount",
    "publishedAt",
    "authorProfileImageUrl",
    "videoId",
  ],
  tableName: "comments",
  scopingTable: {
    tableName: "videos",
    primaryKey: "id",
    foreignKey: "videoId",
    columns: ["id"],
    schema: {
      id: "TEXT PRIMARY KEY",
    },
  },
};
const youtubeVideosSchema = {
  schema: {
    id: "TEXT PRIMARY KEY",
  },
  columns: ["id"],
  tableName: "videos",
  scopedTable: {
    tableName: "comments",
    primaryKey: "id",
    foreignKey: "videoId",
    schema: {
      id: "TEXT PRIMARY KEY",
      authorDisplayName: "TEXT",
      textOriginal: "TEXT",
      likeCount: "INTEGER",
      totalReplyCount: "INTEGER",
      publishedAt: "TEXT",
      authorProfileImageUrl: "TEXT",
      videoId: "TEXT",
    },
    columns: [
      "id",
      "authorDisplayName",
      "textOriginal",
      "likeCount",
      "totalReplyCount",
      "publishedAt",
      "authorProfileImageUrl",
    ],
  },
};
async function getYouTubeTabToDataFetchKey() {
  const video = await getYouTubeVideo();
  return { type: YOUTUBE, key: `${video.id}` };
}
export async function getYouTubeVideo() {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    const tabUrl = tab?.url;
    if (!tabUrl) throw new Error("Tab URL not set");

    if (!tabUrl.startsWith("https://www.youtube.com/watch"))
      throw new Error(
        "YouTube videos can only be fetched from YouTube watch pages"
      );

    const videoId = new URL(tabUrl).searchParams.get("v");

    if (!videoId) throw new Error("Video ID not set");

    return { id: videoId };
  } catch (error) {
    console.error("Error accessing video:", error);
    throw error;
  }
}

// Renamed function to clarify it fetches the first page
export async function getYouTubeCommentsFirstPage(video, tab) {
  try {
    const url = MOCK_YOUTUBE_API_REQUEST
      ? "MOCKED_YOUTUBE_API_REQUEST"
      : `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&part=replies&videoId=${video.id}&key=${YOUTUBE_API_KEY}&maxResults=${YOUTUBE_MAX_RESULTS}&order=relevance`;

    console.log(`Outgoing request to YouTube API: ${url}`);
    const response = MOCK_YOUTUBE_API_REQUEST
      ? await mockFetch(mockComments, YOUTUBE_MAX_RESULTS)
      : await fetch(url, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

    if (response.status === 400) {
      console.error("Youtube Data API request is malformed");
      throw new Error("Youtube Data API request is malformed");
    }

    if (response.status === 401) {
      console.error("Youtube Data API key is invalid");
      throw new Error("Youtube Data API key is invalid");
    }
    if (response.status === 404) {
      console.error("Youtube Data API resource not found");
      throw new Error("Youtube Data API resource not found");
    }
    if (response.status === 429) {
      console.error("Youtube Data API quota exceeded");
      throw new Error("Youtube Data API quota exceeded");
    }

    if (response.status === 403) {
      console.error("Youtube Data API key is invalid or quota exceeded");
      throw new Error("Youtube Data API key is invalid or quota exceeded");
    }

    if (response.status === 500) {
      console.error("Youtube Data API server error");
      throw new Error("Youtube Data API server error");
    }

    if (!response.ok)
      throw new Error(`API request failed: ${response.statusText}`);

    const data = await response.json();

    console.log(
      `Incoming
      response from YouTube API: ${data.items.length} items`
    );
    await chrome.storage.local.set({
      tabToDataFetch: {
        [tab.id]: {
          YOUTUBE: {
            [video.id]: {
              pageToken: `${data?.nextPageToken}`,
            },
          },
        },
      },
    });
    return data.items.map((item) => ({
      ...item.snippet.topLevelComment.snippet,
      id: item.id,
      totalReplyCount: item.snippet.totalReplyCount,
      videoId: video.id,
    }));
  } catch (error) {
    console.error("Error fetching comments:", error);
    throw error;
  }
}

async function getYouTubeCommentsNextPage(video, tab) {
  try {
    const tabToDataFetch = await chrome.storage.local.get("tabToDataFetch");

    const pageToken =
      tabToDataFetch?.["tabToDataFetch"]?.[`${tab.id}`]?.["YOUTUBE"]?.[
        `${video.id}`
      ]?.["pageToken"];

    const hasPageToken =
      pageToken === "undefined" || typeof pageToken === "undefined"
        ? true
        : false;

    if (!hasPageToken) {
      throw new Error("No page token found");
    }
    const url = MOCK_YOUTUBE_API_REQUEST
      ? "MOCKED_YOUTUBE_API_REQUEST"
      : `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&part=replies&videoId=${video.id}&key=${YOUTUBE_API_KEY}&maxResults=${YOUTUBE_MAX_RESULTS}&order=relevance&pageToken=${pageToken}`;
    console.log(`Outgoing request to YouTube API: ${url}`);
    const response = MOCK_YOUTUBE_API_REQUEST
      ? await mockFetch(mockComments, YOUTUBE_MAX_RESULTS)
      : await fetch(url, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

    if (response.status === 400) {
      console.error("Youtube Data API request is malformed");
      throw new Error("Youtube Data API request is malformed");
    }

    if (response.status === 401) {
      console.error("Youtube Data API key is invalid");
      throw new Error("Youtube Data API key is invalid");
    }
    if (response.status === 404) {
      console.error("Youtube Data API resource not found");
      throw new Error("Youtube Data API resource not found");
    }
    if (response.status === 429) {
      console.error("Youtube Data API quota exceeded");
      throw new Error("Youtube Data API quota exceeded");
    }

    if (response.status === 403) {
      console.error("Youtube Data API key is invalid or quota exceeded");
      throw new Error("Youtube Data API key is invalid or quota exceeded");
    }

    if (response.status === 500) {
      console.error("Youtube Data API server error");
      throw new Error("Youtube Data API server error");
    }

    if (!response.ok)
      throw new Error(`API request failed: ${response.statusText}`);

    const data = await response.json();

    console.log(
      `Incoming response from YouTube API: ${data.items.length} items`
    );

    await chrome.storage.local.set({
      tabToDataFetch: {
        ...(tabToDataFetch?.["tabToDataFetch"] || {}),
        [tab.id]: {
          YOUTUBE: {
            [video.id]: {
              pageToken: `${data?.nextPageToken}`,
            },
          },
        },
      },
    });

    return data.items.map((item) => ({
      ...item.snippet.topLevelComment.snippet,
      id: item.id,
      totalReplyCount: item.snippet.totalReplyCount,
      videoId: video.id,
    }));
  } catch (error) {
    console.error("Error fetching comments:", error);
    throw error;
  }
}

export { youtubeCommentsSchema, youtubeVideosSchema };
