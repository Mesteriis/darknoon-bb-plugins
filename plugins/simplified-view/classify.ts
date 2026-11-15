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
  /** A mid-turn "Steer" message (it does not end the running turn). */
  isSteer?: boolean;
}

const TURN_RE = /(?:^|[|:])turn:([^|:]+)|^([^:|]+-t\d+):/;

export function rowTurn(messageId: string): string | null {
  const match = TURN_RE.exec(messageId);
  return match?.[1] ?? match?.[2] ?? null;
}

/**
 * A chat bubble that is not the agent's: a saved user message
 * (`user-seed:N`) or the optimistic copy bb shows the moment you send
 * (`r-<random>`). Generated "Message from" rows are not bubbles.
 */
function isHumanMessage(messageId: string, row: TimelineRowInput): boolean {
  return row.isMessageColumn && !messageId.startsWith("assistant:");
}

export function classifyRows(
  threadId: string,
  rows: readonly TimelineRowInput[],
  running: boolean,
  /** The latest turn seen while the thread was idle; it is finished. */
  finishedTurn: string | null = null,
): Map<string, RowVisibility> {
  const prefix = `${threadId}:`;
  const result = new Map<string, RowVisibility>();
  const own = rows.filter((row) => row.id.startsWith(prefix));

  // The turn still in progress: the turn of the last row that names one,
  // unless that turn already finished. A turn is finished once bb adds its
  // "Worked for" row (`<turn>:turn:<n>`) or a new, non-steer human message
  // follows it (the moment after you send, before the new turn has rows).
  let currentTurn: string | null = null;
  if (running) {
    let lastIndex = -1;
    for (let i = own.length - 1; i >= 0 && currentTurn === null; i--) {
      currentTurn = rowTurn(own[i]!.id.slice(prefix.length));
      if (currentTurn !== null) lastIndex = i;
    }
    if (currentTurn !== null) {
      const turn = currentTurn;
      const hasSummary = own.some((row) =>
        row.id.slice(prefix.length).startsWith(`${turn}:turn:`),
      );
      const humanAfter = own
        .slice(lastIndex + 1)
        .some(
          (row) =>
            isHumanMessage(row.id.slice(prefix.length), row) && !row.isSteer,
        );
      if (hasSummary || humanAfter || turn === finishedTurn) currentTurn = null;
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
    if (isHumanMessage(messageId, row)) {
      visibility = "show";
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

/** The turn named by the thread's last row that names one. */
export function latestTurn(
  threadId: string,
  rows: readonly TimelineRowInput[],
): string | null {
  const prefix = `${threadId}:`;
  for (let i = rows.length - 1; i >= 0; i--) {
    const id = rows[i]!.id;
    if (!id.startsWith(prefix)) continue;
    const turn = rowTurn(id.slice(prefix.length));
    if (turn !== null) return turn;
  }
  return null;
}
