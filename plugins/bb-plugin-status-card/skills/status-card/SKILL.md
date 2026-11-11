---
name: status-card
description: Maintain a compact, evidence-backed work card above this thread’s composer.
---
Read with `status_card_read`; publish one snapshot using its revision (0 if absent). Re-read conflicts. Publishing replaces the card: retain useful unfinished work and pending decisions.

Use stable IDs, real owners, exact timestamped evidence, and verified links. Include pre-PR tasks. Never invent activity; omit filler. Keep CI and PR/deployment state separate. Retain merged PRs until deployment is resolved. Offer Merge only on open PRs; actions draft requests, never execute directly.

Decisions need concise context and explicit options; More info is automatic. Normal attention stays green; `priority: important` is yellow, `urgent` red. Reserve urgency for real consequences.

Show the three most useful items per lane. Retire stale completed work. Spend uses metric amounts and a lane summary. `status_card_clear` removes the card.
