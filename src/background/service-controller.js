import { getMessageTransactionKey } from "../lib/shared-utils";
import {
  createScopeQuery,
  executeQuery,
  parseQueryResults,
  runInsertQuery,
} from "./service-infra.js";
import { getCurrentTab } from "./service-utils.js";
import {
  getYouTubeCommentsFirstPage,
  getYouTubeVideo,
  youtubeCommentsSchema,
  youtubeVideosSchema,
} from "./service-vendors.js";

async function handleExternalResponse(payload) {
  return await chrome.runtime.sendMessage(
    { action: "RESPONSE", payload },
    (response) => {
      if (chrome.runtime?.lastError)
        throw new Error(
          `(SERVICE_WORKER) (${
            payload?.status || "'No Status Found'"
          }) RESPONSE[${
            payload?.request?.action || "'No Action Found'"
          }]:\n${JSON.stringify(chrome.runtime?.lastError, null, 2)}`
        );

      if (response)
        console.log(
          `(SERVICE_WORKER) (${
            payload?.status || "'No Status Found'"
          }) RESPONSE[${
            payload?.request?.action || "'No Action Found'"
          }]:\n${JSON.stringify(response, null, 2)}`
        );
    }
  );
}

export async function handleExternalRequest(request) {
  try {
    request = {
      ...request,
      transactionKey: await getMessageTransactionKey(request),
    };
    await handleExternalResponse({
      request,
      status: "LOADING",
      data: null,
      error: null,
    });

    await handleExternalResponse({
      request,
      status: "DONE",
      data: await handleRequestQueue([request].flat()),
      error: null,
    });
  } catch (error) {
    await handleExternalResponse({
      request,
      status: "ERROR",
      data: null,
      error: error.message,
    });
  }
}

async function handleRequest(request) {
  const { action, payload } = request;
  let executeAction = null;

  const actions = {
    LOAD_YOUTUBE_VIEW_DATA: async () =>
      await handleRequestQueue([
        { action: "LOAD_YOUTUBE_VIDEO_DATA" },
        { action: "LOAD_YOUTUBE_VIDEO_COMMENT_DATA" },
        {
          action: "EXECUTE_YOUTUBE_COMMENT_DATA_QUERY",
          payload: {
            query: `SELECT * FROM ${youtubeCommentsSchema.tableName}`,
          },
        },
      ]),
    LOAD_YOUTUBE_VIDEO_DATA: async () =>
      await runInsertQuery(await getYouTubeVideo(), youtubeVideosSchema),
    LOAD_YOUTUBE_VIDEO_COMMENT_DATA: async () => {
      const [video, tab] = await Promise.all([
        getYouTubeVideo(),
        getCurrentTab(),
      ]);
      await runInsertQuery(
        await getYouTubeCommentsFirstPage(video, tab),
        youtubeCommentsSchema
      );
    },
    EXECUTE_YOUTUBE_COMMENT_DATA_QUERY: async () =>
      parseQueryResults(
        await executeQuery(
          await createScopeQuery(
            payload.query,
            youtubeCommentsSchema,
            await getYouTubeVideo()
          )
        )
      ),
  };

  if (!actions[action]) {
    throw new Error(`Unknown action: ${action}`);
  } else {
    executeAction = actions[action];
  }

  return await executeAction(request);
}

async function handleRequestQueue(requests) {
  let results = [];
  for (const request of requests) {
    const result = await handleRequest(request);
    if (result) results = [...results, result.flat()];
  }
  return results;
}
