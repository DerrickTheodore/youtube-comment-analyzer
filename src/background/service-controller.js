import { executeQuery, insertData } from "./service-infra.js";
import {
  fetchYouTubeComments,
  youtubeCommentsSchema,
} from "./service-vendors.js";

export async function handleRequest(
  request,
  sendResponse,
  timeout,
  onComplete
) {
  const { action, payload } = request;
  const timer = setTimeout(() => {
    sendResponse({ status: "TIMEOUT" });
    onComplete();
  }, timeout);

  try {
    switch (action) {
      case "EXECUTE_QUERY":
        if (!payload?.query) throw new Error("No query provided");
        executeQuery(payload.query);
        sendResponse({ status: "SUCCESS" });
        break;

      case "POPUP_OPENED":
        insertData({
          fetchData: fetchYouTubeComments,
          dataSchema: youtubeCommentsSchema,
        });
        sendResponse({ status: "SUCCESS", message: "Popup opened" });
        break;

      case "POPUP_CLOSED":
        sendResponse({ status: "SUCCESS", message: "Popup closed" });
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    sendResponse({ status: "ERROR", error: error.message });
  } finally {
    clearTimeout(timer);
    onComplete();
  }
}
