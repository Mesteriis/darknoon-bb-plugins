# Status Card

Agent-maintained work lanes above a BB thread's composer: tasks, PRs, run links,
spend and decisions. Decision details open the native right-side panel. Tasks
link to their owning chat. Live actions draft requests; they never merge or send
a message automatically. Historical examples simulate choices.

Each plugin in this repository owns its package manifest and committed npm
lockfile. Install development dependencies with `npm ci`, then run:

```sh
npm run typecheck
npm test
bb plugin build .
```

Install from this directory with `bb plugin install .`; after changes, build and
`bb plugin reload status-card`. Saved cards are preserved across reloads.
The SQLite, cron-parser and Hono development dependencies are imported by the
SDK's test harness; they are not services added by this plugin.

`bb status-card show --json` reads this thread's card; `hide` removes it.
`examples` replaces it with the five sourced historical review snapshots.
No card appears in other threads until their agent publishes one.

`node build-preview.mjs [output.html]` builds the standalone design preview.
The normal card displays three items per lane. Per-item dismissal remains a
proposed design, not an implemented feature.
