# UI contract

- Fixed 96px content area with three 32px rows; no footer, paging arrow or visible design controls.
- Decisions occupy ordinary rows. Details opens BB's native side panel, preserving the card.
- Task owner links use native chat-name pills. Run links open the platform artifact.
- PRs show one leading status marker, title, specific activity and an action. CI is structured separately, with details in the marker tooltip.
- Completed tasks use a green check. Normal attention stays green; important decisions yellow, urgent decisions red. Counts do not imply urgency.
- Artifact titles underline on hover; action controls do not.
- Agent instructions describe content semantics, not visual implementation.
- Historical review data is sourced; it never claims to be live. Historical choices simulate; live choices insert a draft.
- Per-item dismissal is proposed, not implemented.
