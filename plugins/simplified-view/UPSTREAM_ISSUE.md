# Draft issue for get-bb/bb (not filed)

**Title:** Plugin hook to hide timeline rows (for conversation-only thread views)

## Problem

Some threads are bots a person chats with (an assistant, a persona). In those,
the timeline is mostly work rows, progress notes, "Message from <thread>" and
"Sent to <thread>" rows. The person wants a conversation view: their own
messages, the agent's final reply per turn, and a "Working…" line while it runs.

Nothing in bb or the Plugin SDK can hide rows today:

- No setting or UI preference (`packages/domain/src/ui-preferences.ts`).
- `experimental_timelineRenderer` only covers a plugin's own row kinds and
  generic tool rows. "Sent to" rows are rendered before plugin renderers
  (`ThreadTimelineRows.tsx`, `parseSentThreadMessage`), and "Message from"
  rows are conversation rows.
- Collapse keeps agent messages visible on purpose
  (`isTimelineUngroupableMessage`, `isSummarizableActivityRow`).

A plugin (darknoon/bb-plugins `simplified-view`) does this now by reading
`data-timeline-row-id` and `[data-message-column]` in the DOM and hiding rows
with CSS. It works, but it depends on private row-id formats, and windowed
timelines measure hidden rows, so they must stay 1px tall.

## Proposal

Add a frontend slot that filters timeline rows before layout and windowing:

```ts
app.slots.experimental_timelineRowFilter({
  id: "conversation-only",
  // Called with the thread in view; return null to leave the timeline alone.
  useFilter: ({ threadId }) => (row) => "show" | "hide",
});
```

`row` is a small, stable, public description, not the internal view row:

```ts
{
  id: string;
  kind: "user-message" | "agent-message" | "agent-to-agent" | "work" | "system" | "error";
  turnId: string | null;
  isFinalInTurn: boolean;   // last agent message of a finished turn
  direction?: "incoming" | "outgoing"; // for agent-to-agent
  peerThreadId?: string;
}
```

Hidden rows are dropped before windowing, so spacing and scroll anchoring stay
right. Errors and pending interactions should not be hideable.

### Smaller alternative

If a plugin hook is too broad, a per-thread view preference in core:
`timeline.view: "full" | "conversation"` (thread menu → Simplified view). It
covers this use case but not variants such as "show agent-to-agent rows as one
compact line".

## Notes

- Possibly related to #6299 (not re-checked).
- Separate question, not part of this issue: in conversation view, which agent
  messages should notify. Today notifications follow turn completion and the
  thread's notification level, not which message the agent meant for the user.
