"use client";

import { useSyncExternalStore } from "react";

const subscribe = (onStoreChange: () => void) => {
  window.addEventListener("kylon:bridge-ready", onStoreChange);
  return () => window.removeEventListener("kylon:bridge-ready", onStoreChange);
};
const getSnapshot = () => {
  if (typeof window === "undefined" || !window.KylonBridge) return false;
  // The Kylon browser extension also injects a bridge into plain top-level
  // tabs; only an embedded (iframe) app is actually inside the shell.
  return window.self !== window.top;
};
const getServerSnapshot = () => false;

/**
 * True when the app is embedded in the Kylon app shell (the shell injects
 * `window.KylonBridge` and embeds the app), false when opened directly in a
 * browser tab. SSR renders the browser default; the `kylon:bridge-ready`
 * event re-checks when the shell injects the bridge after hydration.
 */
export function useIsKylonShell() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
