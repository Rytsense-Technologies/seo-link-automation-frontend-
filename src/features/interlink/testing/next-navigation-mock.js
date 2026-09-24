import { useMemo, useSyncExternalStore } from "react";

/**
 * Test stand-in for `next/navigation`, backed by jsdom's real `window.location` / `history`.
 * Next.js syncs `history.pushState` with `useSearchParams`; this reproduces that, so tests
 * exercise the real URL round-trip (write -> URL -> read) and back/forward via `popstate`.
 *
 * Use with: vi.mock("next/navigation", () => import("../testing/next-navigation-mock"));
 */

const LOCATION_CHANGE = "test:locationchange";

const originalPushState = window.history.pushState.bind(window.history);
window.history.pushState = (...args) => {
  originalPushState(...args);
  window.dispatchEvent(new Event(LOCATION_CHANGE));
};

function subscribe(onChange) {
  window.addEventListener("popstate", onChange);
  window.addEventListener(LOCATION_CHANGE, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(LOCATION_CHANGE, onChange);
  };
}

export function useSearchParams() {
  const search = useSyncExternalStore(subscribe, () => window.location.search);
  return useMemo(() => new URLSearchParams(search), [search]);
}

export function usePathname() {
  return useSyncExternalStore(subscribe, () => window.location.pathname);
}

/** Puts the test at a URL without creating a history entry the component would see as a change. */
export function setTestUrl(url) {
  window.history.replaceState(null, "", url);
}

/** Simulates the browser back button. jsdom's history.back() is async and fires popstate itself. */
export async function goBack() {
  const popped = new Promise((resolve) => window.addEventListener("popstate", () => resolve(), { once: true }));
  window.history.back();
  await popped;
}
