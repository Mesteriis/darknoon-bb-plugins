import { useEffect, useState, useSyncExternalStore } from "react";
import {
  definePluginApp,
  experimental_useSidebarThreads,
  useBbContext,
  useSdk,
} from "@get-bb/plugin-sdk/app";
import { classifyRows, type TimelineRowInput } from "./classify";

/** Thread plugin metadata key; `true` turns the simplified view on. */
export const METADATA_KEY = "simplified";
const ROW_ATTR = "data-bb-simplified";
const LIST_ATTR = "data-bb-simplified-list";
const BUSY_STATUSES = new Set(["starting", "active", "stopping"]);

// --- Per-thread on/off, shared by the menu action and the overlay ----------
const enabled = new Map<string, boolean>();
const listeners = new Set<() => void>();
let version = 0;
function setEnabled(threadId: string, value: boolean): void {
  if (enabled.get(threadId) === value) return;
  enabled.set(threadId, value);
  version++;
  for (const listener of listeners) listener();
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
[${ROW_ATTR}="hide"]:not([data-timeline-windowed-realized]) { display: none !important; }
/* Windowed timelines measure each row; a 0px row falls back to its estimate
   and leaves a gap, so collapse hidden rows to 1px instead. */
[${ROW_ATTR}="hide"][data-timeline-windowed-realized] { height: 1px !important; overflow: hidden !important; }
[${ROW_ATTR}="hide"][data-timeline-windowed-realized] > * { visibility: hidden !important; }
`;

// --- DOM pass ----------------------------------------------------------------
const TOP_LEVEL_ROWS =
  '[data-timeline-row-list="top-level"] > [data-timeline-items] > [data-timeline-row-id]';

function applyToDom(threadId: string, running: boolean): void {
  const prefix = `${threadId}:`;
  const elements = [
    ...document.querySelectorAll<HTMLElement>(TOP_LEVEL_ROWS),
  ].filter((el) => el.getAttribute("data-timeline-row-id")!.startsWith(prefix));
  const inputs: TimelineRowInput[] = elements.map((el) => ({
    id: el.getAttribute("data-timeline-row-id")!,
    isMessageColumn:
      el.firstElementChild?.hasAttribute("data-message-column") ?? false,
  }));
  const visibility = classifyRows(threadId, inputs, running);
  const lists = new Set<HTMLElement>();
  elements.forEach((el, i) => {
    const next = visibility.get(inputs[i]!.id) ?? "show";
    if (el.getAttribute(ROW_ATTR) !== next) el.setAttribute(ROW_ATTR, next);
    const list = el.closest<HTMLElement>('[data-timeline-row-list="top-level"]');
    if (list) lists.add(list);
  });
  for (const list of document.querySelectorAll<HTMLElement>(`[${LIST_ATTR}]`)) {
    if (!lists.has(list)) list.removeAttribute(LIST_ATTR);
  }
  const listState = running ? "running" : "idle";
  for (const list of lists) {
    if (list.getAttribute(LIST_ATTR) !== listState) list.setAttribute(LIST_ATTR, listState);
  }
}

function clearDom(): void {
  for (const el of document.querySelectorAll(`[${ROW_ATTR}]`)) el.removeAttribute(ROW_ATTR);
  for (const el of document.querySelectorAll(`[${LIST_ATTR}]`)) el.removeAttribute(LIST_ATTR);
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

  useEffect(() => {
    if (threadId === null || enabled.has(threadId)) return;
    let cancelled = false;
    sdk.threads.getPluginMetadata({ threadId }).then(
      (metadata) => {
        if (!cancelled) setEnabled(threadId, readFlag(metadata));
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
        applyToDom(threadId, running);
      });
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    applyToDom(threadId, running);
    return () => {
      observer.disconnect();
      if (frame !== 0) cancelAnimationFrame(frame);
      clearDom();
      style.remove();
    };
  }, [on, threadId, running]);

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
    icon: "MessageSquareText",
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
              setEnabled(entry.threadId, readFlag(entry.metadata));
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
        detail: isOn
          ? "Showing only your messages and the agent's replies"
          : "Hide work, progress notes and agent-to-agent messages",
        icon: "MessageSquareText",
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
});
