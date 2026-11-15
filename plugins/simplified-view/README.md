# Simplified View

A per-thread conversation view for bot-style threads: shows your messages and
each turn's final agent reply. Hides tool/work rows, progress notes,
"Message from <thread>" / "Sent to <thread>" rows, and child-thread "finished"
notices. While the agent is working, the turn shows only bb's own
"Working…" line.

Turn it on from a thread's actions menu: **Simplified view**. Turn it off with
**Show full timeline**. The flag is stored as thread plugin metadata
(`simplified: true`), so it follows the thread across devices.

## How it works and its limits

The Plugin SDK has no timeline filter, so an app overlay tags rows in the DOM
and a stylesheet hides them. It keys on bb internals, not a public contract:

- `data-timeline-row-id` = `<threadId>:<message id>`; message ids look like
  `user-seed:N`, `assistant:kind:assistant|turn:<t>|…`, `command:…`,
  `<t>:work-summary:…`.
- Human messages render as `[data-message-column]`; bb's generated rows
  ("Message from", "<child> finished") do not.

A bb update that renames these will make the view show everything again (it
fails open, never hides your messages). Other limits:

- "Final reply" is the last agent message of a turn among rendered rows. In
  long, windowed timelines an earlier note can show briefly until the later
  one scrolls into the render window.
- Windowed timelines keep hidden rows at 1px (bb measures every row), so
  spacing is a little looser than a native filter would give.
- Replies to mid-turn steers stay hidden until the turn ends.
- Errors shown as timeline rows are hidden too.

[UPSTREAM_ISSUE.md](UPSTREAM_ISSUE.md) drafts the bb change that would make
this robust.
