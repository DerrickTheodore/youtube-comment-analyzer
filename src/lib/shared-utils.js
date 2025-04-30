import {
  getCurrentTab,
  getCurrentURL,
  getCurrentWindow,
} from "../background/service-utils.js";

async function generateHashFromKey(key) {
  const msgBuffer = new TextEncoder().encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function getMessageTransactionKey(request) {
  try {
    const { action } = request;
    const { id: tabId } = await getCurrentTab();
    const { id: windowId } = await getCurrentWindow();
    const url = new URL(await getCurrentURL()).origin;
    const key = `${windowId}-${tabId}-${url}-${action}`;
    const transactionKey = await generateHashFromKey(key);
    return transactionKey;
  } catch (error) {
    console.error("Error getting transaction key:", error);
    throw error;
  }
}

/**
 * Creates a Chrome runtime message listener that handles async callbacks.
 * Allows using async/await directly within the handler function provided.
 * Automatically handles calling sendResponse with success or error status,
 * and ensures 'return true' is called synchronously to keep the message port open.
 *
 * @param {function(object, chrome.runtime.MessageSender): Promise<any>} handlerCallback
 *   An async function that receives the 'request' and 'sender' objects.
 *   It should process the request using await as needed and return the data
 *   to be sent as a response, or throw an error if processing fails.
 * @returns {function(object, chrome.runtime.MessageSender, function): boolean}
 *   The actual listener function suitable for passing to chrome.runtime.onMessage.addListener.
 */
export function asyncMessageHandler(handlerCallback) {
  return (request, sender, sendResponse) => {
    (async () => {
      try {
        const result = await handlerCallback(request, sender);
        sendResponse({ status: "success", data: result });
      } catch (error) {
        console.error("Error in async message handler:", error);
        sendResponse({
          status: "error",
          message: error?.message || "Unknown error occurred",
        });
      }
    })();

    return true;
  };
}
