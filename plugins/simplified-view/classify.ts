/**
 * Decides which timeline rows a simplified thread shows.
 *
 * bb gives each top-level timeline row `data-timeline-row-id` =
 * `<threadId>:<message id>`, and the message id names its kind:
 *   user-seed:<n>                          user-role message (human, or an
 *                                          agent's `bb thread tell`, or a
 *                                          child-thread "finished" notice)
 *   assistant:kind:assistant|turn:<t>|...  agent text
 *   <t>:work-summary:..., command:..., op:..., <t>:turn:0, ...  work/system
 * Human messages render as a plain message column; bb's generated rows
 * ("Message from", "<child> finished") render as a collapsible title instead.
 */

export type RowVisibility = "show" | "hide";

export interface TimelineRowInput {
  /** `data-timeline-row-id`, including the thread prefix. */
  id: string;
  /** The row's first element is a `[data-message-column]` (a chat bubble). */
  isMessageColumn: boolean;
}

const TURN_RE = /(?:^|[|:])turn:([^|:]+)|^([^:|]+-t\d+):/;

export function rowTurn(messageId: string): string | null {
  const match = TURN_RE.exec(messageId);
  return match?.[1] ?? match?.[2] ?? null;
}

export function classifyRows(
  threadId: string,
  rows: readonly TimelineRowInput[],
  running: boolean,
): Map<string, RowVisibility> {
  const prefix = `${threadId}:`;
  const result = new Map<string, RowVisibility>();
  const own = rows.filter((row) => row.id.startsWith(prefix));

  // The turn still in progress: the turn of the last row that names one.
  let currentTurn: string | null = null;
  if (running) {
    for (let i = own.length - 1; i >= 0 && currentTurn === null; i--) {
      currentTurn = rowTurn(own[i]!.id.slice(prefix.length));
    }
  }

  // Last agent message per turn = the agent's intentional reply.
  const lastAssistantByTurn = new Map<string, string>();
  for (const row of own) {
    const messageId = row.id.slice(prefix.length);
    if (!messageId.startsWith("assistant:") || !row.isMessageColumn) continue;
    const turn = rowTurn(messageId);
    if (turn !== null) lastAssistantByTurn.set(turn, row.id);
  }

  for (const row of own) {
    const messageId = row.id.slice(prefix.length);
    let visibility: RowVisibility = "hide";
    if (messageId.startsWith("user-seed:")) {
      visibility = row.isMessageColumn ? "show" : "hide";
    } else if (messageId.startsWith("assistant:") && row.isMessageColumn) {
      const turn = rowTurn(messageId);
      visibility =
        turn !== null &&
        turn !== currentTurn &&
        lastAssistantByTurn.get(turn) === row.id
          ? "show"
          : "hide";
    }
    result.set(row.id, visibility);
  }
  return result;
}
