import { useEffect, useState, useSyncExternalStore } from "react";
import {
  definePluginApp,
  experimental_useSidebarThreads,
  useBbContext,
  useSdk,
} from "@get-bb/plugin-sdk/app";
import { BUBBLE_COLORS, COLOR_KEY, colorInk, colorValue } from "./palette";
import { classifyRows, latestTurn, type TimelineRowInput } from "./classify";

/** Thread plugin metadata key; `true` turns the simplified view on. */
export const METADATA_KEY = "simplified";
const ROW_ATTR = "data-bb-simplified";
const LIST_ATTR = "data-bb-simplified-list";
const LABEL_ATTR = "data-bb-simplified-label";
const AGENT_ATTR = "data-bb-simplified-agent"; // "read" | "unread"
const HUMAN_ATTR = "data-bb-simplified-human";
const COLOR_VAR = "--bb-simplified-user";
const INK_VAR = "--bb-simplified-user-ink";
const BUSY_STATUSES = new Set(["starting", "active", "stopping"]);

// --- Per-thread on/off, shared by the menu action and the overlay ----------
const enabled = new Map<string, boolean>();
const colors = new Map<string, string | null>();
const listeners = new Set<() => void>();
let version = 0;
function setEnabled(threadId: string, value: boolean): void {
  if (enabled.get(threadId) === value) return;
  enabled.set(threadId, value);
  version++;
  for (const listener of listeners) listener();
}
function setColor(threadId: string, value: string | null): void {
  if (colors.get(threadId) === value) return;
  colors.set(threadId, value);
  version++;
  for (const listener of listeners) listener();
}
function storeMetadata(threadId: string, metadata: unknown): void {
  setEnabled(threadId, readFlag(metadata));
  const raw =
    typeof metadata === "object" && metadata !== null
      ? (metadata as Record<string, unknown>)[COLOR_KEY]
      : null;
  setColor(threadId, colorValue(raw) === null ? null : (raw as string));
}
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function useStoreVersion(): number {
  return useSyncExternalStore(subscribe, () => version);
}
function readFlag(metadata: unknown): boolean {
  return (
    typeof metadata === "object" &&
    metadata !== null &&
    (metadata as Record<string, unknown>)[METADATA_KEY] === true
  );
}

// --- Styles ----------------------------------------------------------------
const STYLE = `
[${LABEL_ATTR}] { display: none !important; }
/* User bubbles as wide as agent bubbles (bb caps them at 70%). */
[${HUMAN_ATTR}] [data-message-column] > .ml-auto { max-width: 85% !important; }
/* The user's bubbles are filled with the thread's color. */
[${LIST_ATTR}][style*="${COLOR_VAR}"] [${HUMAN_ATTR}] .rounded-xl.bg-surface-recessed {
  background: var(${COLOR_VAR}); border-color: transparent;
}
[${LIST_ATTR}][style*="${COLOR_VAR}"] [${HUMAN_ATTR}] .rounded-xl.bg-surface-recessed * {
  color: var(${INK_VAR}) !important;
}
/* No "New" divider: unread replies get a brighter bubble instead. */
[${LIST_ATTR}] [data-timeline-window-key^="divider:"]:not([data-timeline-windowed-realized]) { display: none !important; }
[${LIST_ATTR}] [data-timeline-window-key^="divider:"][data-timeline-windowed-realized] { height: 1px !important; overflow: hidden !important; visibility: hidden !important; }
/* Agent replies as left-side bubbles, matching the user's bubble. */
[${AGENT_ATTR}] [data-sidebar-swipe-selectable] > [data-markdown-preview] {
  width: fit-content; max-width: 85%;
  padding: 10px 16px; border-radius: 12px;
  border: 0; background: var(--surface-recessed);
}
[${AGENT_ATTR}] [data-sidebar-swipe-selectable] > [data-markdown-preview] > :last-child { margin-bottom: 0 !important; }
[${AGENT_ATTR}="unread"] [data-sidebar-swipe-selectable] > [data-markdown-preview] {
  /* Unread: a step stronger fill than read replies. */
  background: color-mix(in oklab, var(--foreground) 12%, transparent);
}
[${ROW_ATTR}="hide"]:not([data-timeline-windowed-realized]) { display: none !important; }
/* Windowed timelines measure each row; a 0px row falls back to its estimate
   and leaves a gap, so collapse hidden rows to 1px instead. */
[${ROW_ATTR}="hide"][data-timeline-windowed-realized] { height: 1px !important; overflow: hidden !important; }
[${ROW_ATTR}="hide"][data-timeline-windowed-realized] > * { visibility: hidden !important; }
`;

// --- DOM pass ----------------------------------------------------------------
const TOP_LEVEL_ROWS =
  '[data-timeline-row-list="top-level"] > [data-timeline-items] > [data-timeline-row-id]';

// Latest turn seen while each thread was idle. bb reports "running" a moment
// before the sent message renders; without this the previous reply flickers.
const finishedTurns = new Map<string, string | null>();

function applyToDom(threadId: string, running: boolean, color: string | null): void {
  const prefix = `${threadId}:`;
  const elements = [
    ...document.querySelectorAll<HTMLElement>(TOP_LEVEL_ROWS),
  ].filter((el) => el.getAttribute("data-timeline-row-id")!.startsWith(prefix));
  const inputs: TimelineRowInput[] = elements.map((el) => ({
    id: el.getAttribute("data-timeline-row-id")!,
    isMessageColumn:
      el.firstElementChild?.hasAttribute("data-message-column") ?? false,
    isSteer: [...el.querySelectorAll("[data-message-column] span")].some(
      (span) => span.textContent?.trim() === "Steer",
    ),
  }));
  if (!running) finishedTurns.set(threadId, latestTurn(threadId, inputs));
  const visibility = classifyRows(
    threadId,
    inputs,
    running,
    finishedTurns.get(threadId) ?? null,
  );
  const lists = new Set<HTMLElement>();
  const divider = document.querySelector(
    '[data-timeline-row-list="top-level"] [data-timeline-window-key^="divider:"]',
  );
  elements.forEach((el, i) => {
    const next = visibility.get(inputs[i]!.id) ?? "show";
    if (el.getAttribute(ROW_ATTR) !== next) el.setAttribute(ROW_ATTR, next);
    const isAgent =
      next === "show" &&
      inputs[i]!.id.slice(threadId.length + 1).startsWith("assistant:");
    const agent = !isAgent
      ? null
      : divider !== null &&
          divider.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING
        ? "unread"
        : "read";
    const isHuman = next === "show" && inputs[i]!.isMessageColumn && !isAgent;
    if (isHuman !== el.hasAttribute(HUMAN_ATTR)) el.toggleAttribute(HUMAN_ATTR, isHuman);
    if (agent === null) el.removeAttribute(AGENT_ATTR);
    else if (el.getAttribute(AGENT_ATTR) !== agent) el.setAttribute(AGENT_ATTR, agent);
    const list = el.closest<HTMLElement>('[data-timeline-row-list="top-level"]');
    if (list) lists.add(list);
    // The "Steer" label above mid-turn messages is noise here.
    if (next === "show") {
      for (const span of el.querySelectorAll<HTMLElement>("[data-message-column] span")) {
        if (span.textContent?.trim() === "Steer" && span.parentElement && !span.parentElement.hasAttribute(LABEL_ATTR)) {
          span.parentElement.setAttribute(LABEL_ATTR, "");
        }
      }
    }
  });
  for (const list of document.querySelectorAll<HTMLElement>(`[${LIST_ATTR}]`)) {
    if (!lists.has(list)) {
      list.removeAttribute(LIST_ATTR);
      list.style.removeProperty(COLOR_VAR);
      list.style.removeProperty(INK_VAR);
    }
  }
  const listState = running ? "running" : "idle";
  for (const list of lists) {
    if (list.getAttribute(LIST_ATTR) !== listState) list.setAttribute(LIST_ATTR, listState);
    if (color === null) {
      list.style.removeProperty(COLOR_VAR);
      list.style.removeProperty(INK_VAR);
    } else if (list.style.getPropertyValue(COLOR_VAR) !== color) {
      list.style.setProperty(COLOR_VAR, color);
      list.style.setProperty(INK_VAR, colorInk(color));
    }
  }
}

function clearDom(): void {
  for (const el of document.querySelectorAll(`[${AGENT_ATTR}]`)) el.removeAttribute(AGENT_ATTR);
  for (const el of document.querySelectorAll(`[${LABEL_ATTR}]`)) el.removeAttribute(LABEL_ATTR);
  for (const el of document.querySelectorAll(`[${ROW_ATTR}]`)) el.removeAttribute(ROW_ATTR);
  for (const el of document.querySelectorAll<HTMLElement>(`[${LIST_ATTR}]`)) {
    el.removeAttribute(LIST_ATTR);
    el.style.removeProperty(COLOR_VAR);
    el.style.removeProperty(INK_VAR);
  }
  for (const el of document.querySelectorAll(`[${HUMAN_ATTR}]`)) el.removeAttribute(HUMAN_ATTR);
}

// --- Overlay: owns the DOM pass for the thread in view ----------------------
function SimplifiedTimeline() {
  const { threadId } = useBbContext();
  const sdk = useSdk();
  useStoreVersion();
  const [loadError, setLoadError] = useState(false);
  const sidebar = experimental_useSidebarThreads();
  const status = sidebar.threads.find((t) => t.id === threadId)?.status;
  const running = status !== undefined && BUSY_STATUSES.has(status);
  const on = threadId !== null && enabled.get(threadId) === true;
  const color = colorValue(threadId === null ? null : colors.get(threadId));

  useEffect(() => {
    // Refetch on every visit: another client or an agent may have changed it.
    if (threadId === null) return;
    let cancelled = false;
    sdk.threads.getPluginMetadata({ threadId }).then(
      (metadata) => {
        if (!cancelled) storeMetadata(threadId, metadata);
      },
      () => {
        if (!cancelled) setLoadError(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [sdk, threadId, loadError]);

  useEffect(() => {
    if (!on || threadId === null) return;
    const style = document.createElement("style");
    style.setAttribute("data-bb-simplified-style", "");
    style.textContent = STYLE;
    document.head.append(style);
    let frame = 0;
    const schedule = () => {
      if (frame !== 0) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        applyToDom(threadId, running, color);
      });
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    applyToDom(threadId, running, color);
    return () => {
      observer.disconnect();
      if (frame !== 0) cancelAnimationFrame(frame);
      clearDom();
      style.remove();
    };
  }, [on, threadId, running, color]);

  return null;
}

export default definePluginApp((app) => {
  app.slots.experimental_appOverlay({
    id: "simplified-timeline",
    component: SimplifiedTimeline,
  });

  app.slots.experimental_threadAction<number>({
    id: "toggle-simplified-view",
    title: "Simplified view",
    icon: "EyeOff",
    group: "settings",
    useData: ({ threadIds }) => {
      const sdk = useSdk();
      const current = useStoreVersion();
      const missing = threadIds.filter((id) => !enabled.has(id));
      const key = missing.join(",");
      useEffect(() => {
        if (missing.length === 0) return;
        let cancelled = false;
        sdk.threads
          .experimental_listPluginMetadata({ threadIds: missing })
          .then(({ threads }) => {
            if (cancelled) return;
            const seen = new Set<string>();
            for (const entry of threads) {
              seen.add(entry.threadId);
              storeMetadata(entry.threadId, entry.metadata);
            }
            for (const id of missing) if (!seen.has(id)) setEnabled(id, false);
          })
          .catch(() => {});
        return () => {
          cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [sdk, key]);
      return current;
    },
    item: ({ thread, sdk }) => {
      const isOn = enabled.get(thread.id) === true;
      return {
        label: isOn ? "Show full timeline" : "Simplified view",
        icon: isOn ? "Eye" : "EyeOff",
        run: async () => {
          const next = !isOn;
          setEnabled(thread.id, next);
          try {
            await sdk.threads.updatePluginMetadata({
              threadId: thread.id,
              ...(next ? { set: { [METADATA_KEY]: true } } : { remove: [METADATA_KEY] }),
            });
          } catch (error) {
            setEnabled(thread.id, isOn);
            throw error;
          }
        },
      };
    },
  });

  app.slots.experimental_threadAction<number>({
    id: "simplified-bubble-color",
    title: "Bubble color",
    icon: "Palette",
    group: "settings",
    order: 10,
    useData: () => useStoreVersion(),
    item: ({ thread, sdk }) => {
      if (enabled.get(thread.id) !== true) return null;
      const current = colors.get(thread.id) ?? null;
      return {
        label: "Bubble color",
        icon: "Palette",
        choices: {
          items: [
            { id: "none", label: "Default", selected: current === null },
            ...BUBBLE_COLORS.map((c) => ({ id: c.id, label: c.label, selected: current === c.id })),
          ],
        },
        run: async ({ value }) => {
          const next = value === undefined || value === "none" ? null : value;
          setColor(thread.id, next);
          try {
            await sdk.threads.updatePluginMetadata({
              threadId: thread.id,
              ...(next === null ? { remove: [COLOR_KEY] } : { set: { [COLOR_KEY]: next } }),
            });
          } catch (error) {
            setColor(thread.id, current);
            throw error;
          }
        },
      };
    },
  });
});
