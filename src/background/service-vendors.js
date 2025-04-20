// Parcel handles process.env variables by inlining them during the build process,
// making them directly available in the browser environment.
// @ts-ignore
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
// @ts-ignore
let YOUTUBE_MAX_RESULTS = process.env.YOUTUBE_MAX_RESULTS;
if (!YOUTUBE_API_KEY) {
  throw new Error("YouTube API key is not set");
}

if (YOUTUBE_MAX_RESULTS === undefined) {
  console.warn("YouTube max results is not set, defaulting to 10");
  YOUTUBE_MAX_RESULTS = 10;
}

if (!Number.parseInt(YOUTUBE_MAX_RESULTS)) {
  throw new Error("YouTube max results is not a number");
}

const youtubeCommentsModel = {
  schema: {
    id: "TEXT PRIMARY KEY",
    authorDisplayName: "TEXT",
    textOriginal: "TEXT",
    likeCount: "INTEGER",
    totalReplyCount: "INTEGER",
    publishedAt: "TEXT",
    authorProfileImageUrl: "TEXT",
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
  tableName: "comments",
};

export { youtubeCommentsModel };
export async function fetchYouTubeComments() {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    const tabUrl = tab?.url;
    if (!tabUrl) throw new Error("Tab URL not set");

    if (!tabUrl.startsWith("https://www.youtube.com/watch"))
      throw new Error(
        "YouTube comments can only be fetched from YouTube watch pages"
      );

    const videoId = new URL(tabUrl).searchParams.get("v");

    if (!videoId) throw new Error("Video ID not set");

    const tabToDataFetchPageToken = await chrome.storage.local.get(
      "tabToDataFetchPageToken"
    );

    const pageToken =
      tabToDataFetchPageToken?.["tabToDataFetchPageToken"]?.[`${tab.id}`]?.[
        "pageToken"
      ];

    const hasPageToken =
      pageToken === "undefined" || typeof pageToken === "undefined"
        ? undefined
        : pageToken;

    const url = `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&part=replies&videoId=${videoId}&key=${YOUTUBE_API_KEY}&maxResults=${YOUTUBE_MAX_RESULTS}&order=relevance${
      hasPageToken ? `&pageToken=${pageToken}` : ""
    }`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

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

    chrome.storage.local.set({
      tabToDataFetchPageToken: {
        ...(tabToDataFetchPageToken?.["tabToDataFetchPageToken"] || {}),
        [tab.id]: {
          pageToken: `${data?.nextPageToken}`,
          videoId,
        },
      },
    });

    const items = data.items.map((item) => ({
      ...item.snippet.topLevelComment.snippet,
      id: item.id,
      totalReplyCount: item.snippet.totalReplyCount,
    }));

    return { items };
  } catch (error) {
    console.error("Error fetching comments:", error);
    throw error;
  }
}
