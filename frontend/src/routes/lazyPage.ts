import { lazy, type ComponentType } from "react";

const RELOAD_KEY = "kanan-chunk-reload";

// Loads one named page component on demand. After a new deployment an open tab may ask for a page
// file that no longer exists; answers and timers are saved on the server, so the page reloads once
// to pick up the current version. A second failure is shown by the error boundary instead.
export function lazyPage<M extends Record<string, unknown>, K extends keyof M>(load: () => Promise<M>, name: K) {
  return lazy(async () => {
    try {
      const module = await load();
      sessionStorage.removeItem(RELOAD_KEY);
      // Pages take their own props; React.lazy needs the loosest component type here.
      return { default: module[name] as ComponentType<any> };
    } catch (error) {
      if (!sessionStorage.getItem(RELOAD_KEY)) {
        sessionStorage.setItem(RELOAD_KEY, "1");
        window.location.reload();
        return new Promise<never>(() => {});
      }
      throw error;
    }
  }) as unknown as M[K];
}
