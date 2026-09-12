import type { Instrumentation } from "next";
import { buildRequestErrorEvent } from "./lib/request-error-event";

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  const event = buildRequestErrorEvent(error, request, context);
  console.error(JSON.stringify(event));
};
