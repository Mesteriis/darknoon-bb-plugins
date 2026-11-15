---
name: simplified-view
description: Turn the Simplified View (conversation-only timeline) on or off for a bb thread.
---

# Simplified View

Simplified View hides work rows, progress notes and agent-to-agent messages in
one thread's timeline, leaving the human's messages and each turn's final
agent reply. It changes only how the thread is displayed.

The person turns it on from the thread's actions menu (**Simplified view**).
The flag is thread plugin metadata `{ "simplified": true }` owned by plugin
`simplified-view`; remove the key to turn it off.

Because only the last message of each turn is shown, put everything the human
needs in your final message of the turn. Earlier progress notes are hidden.
