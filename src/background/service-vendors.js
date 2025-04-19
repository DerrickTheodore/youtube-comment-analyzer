// @ts-ignore
// Parcel handles process.env variables by inlining them during the build process,
// making them directly available in the browser environment.
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
if (!YOUTUBE_API_KEY) {
  throw new Error("YouTube API key is not set");
}

const youtubeCommentsSchema = {};

export { youtubeCommentsSchema };
export async function fetchYouTubeComments() {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    const tabUrl = tab?.url;
    if (tabUrl && tabUrl.startsWith("https://www.youtube.com/watch")) {
      const videoId = new URL(tabUrl).searchParams.get("v");
      if (!videoId) throw new Error("Video ID not set");
      if (YOUTUBE_API_KEY === undefined) throw new Error("API key not set");
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

      const url = `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&part=replies&videoId=${videoId}&key=${YOUTUBE_API_KEY}&maxResults=100&order=relevance${
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

      return { items: data?.items };
    }
  } catch (error) {
    console.error("Error fetching comments:", error);
    throw error;
  }
}
