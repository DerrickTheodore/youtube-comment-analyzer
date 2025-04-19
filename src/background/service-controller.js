import { executeQuery, insertData } from "./service-infra.js";
import {
  fetchYouTubeComments,
  youtubeCommentsSchema,
} from "./service-vendors.js";

// Add comments to explain the purpose of each function and the expected structure of inputs and outputs

/**
 * Handles incoming requests and routes them to the appropriate service.
 * @param {Object} request - The request object received.
 * @param {Function} sendResponse - Callback to send a response.
 */
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

    case "DATA_FETCH_START":
      insertData(fetchYouTubeComments, youtubeCommentsSchema);
      sendResponse({ status: "SUCCESS", message: "Data fetch started" });
      break;

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}
