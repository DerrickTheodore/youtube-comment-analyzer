import { executeQuery, insertData } from "./service-infra.js";
import {
  fetchYouTubeComments,
  youtubeCommentsSchema,
} from "./service-vendors.js";

export function handleRequest(request, sendResponse) {
  const { action, payload } = request;

  switch (action) {
    case "EXECUTE_QUERY":
      if (!payload?.query) throw new Error("No query provided");
      executeQuery(payload.query);
      sendResponse({ status: "SUCCESS", message: "Query command executed" });
      break;

    case "POPUP_OPENED":
      insertData(fetchYouTubeComments, youtubeCommentsSchema);
      sendResponse({ status: "SUCCESS", message: "Popup opened" });
      break;

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}
