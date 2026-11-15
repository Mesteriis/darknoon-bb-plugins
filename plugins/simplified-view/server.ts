import type { BbPluginApi } from "@get-bb/plugin-sdk";

// Frontend-only plugin; bb requires a server entry.
export default function simplifiedView(bb: BbPluginApi) {
  bb.log.info("Simplified View loaded");
}
