import { fetchMockComments } from "../../mocks/fetchMockComments";

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
      const url = `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&part=replies&videoId=${videoId}&key=${YOUTUBE_API_KEY}&maxResults=100&order=relevance`;
      const response = await fetchMockComments();
      if (!response.ok)
        throw new Error(`API request failed: ${response.statusText}`);
      const data = await response.json();

      return data?.items;
    }
  } catch (error) {
    console.error("Error fetching comments:", error);
    throw error;
  }
}
