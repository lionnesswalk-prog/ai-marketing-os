export type QueueHealthState = "healthy" | "watch" | "action";

export type QueueHealthInput = {
  overdueScheduled: number;
  stalePublishing: number;
  longProcessing: number;
  failedLast24h: number;
};

export function classifyQueueHealth(input: QueueHealthInput): {
  state: QueueHealthState;
  label: string;
  detail: string;
} {
  if (input.stalePublishing > 0 || input.failedLast24h > 0) {
    return {
      state: "action",
      label: "Needs attention",
      detail: [
        input.stalePublishing > 0 ? input.stalePublishing + " uncertain publishing claim" + (input.stalePublishing === 1 ? "" : "s") : undefined,
        input.failedLast24h > 0 ? input.failedLast24h + " failed delivery" + (input.failedLast24h === 1 ? "" : "ies") + " in 24h" : undefined,
      ].filter(Boolean).join(" · "),
    };
  }

  if (input.overdueScheduled > 0 || input.longProcessing > 0) {
    return {
      state: "watch",
      label: "Watch queue",
      detail: [
        input.overdueScheduled > 0 ? input.overdueScheduled + " overdue scheduled post" + (input.overdueScheduled === 1 ? "" : "s") : undefined,
        input.longProcessing > 0 ? input.longProcessing + " long-running provider job" + (input.longProcessing === 1 ? "" : "s") : undefined,
      ].filter(Boolean).join(" · "),
    };
  }

  return {
    state: "healthy",
    label: "Queue healthy",
    detail: "No overdue, stale, or recently failed delivery work.",
  };
}
