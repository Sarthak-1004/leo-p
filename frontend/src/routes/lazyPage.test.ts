import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lazyPage } from "./lazyPage";

// React.lazy keeps its loader in _payload._result until first render; call it directly.
type LazyInternals = { _payload: { _result: () => Promise<{ default: unknown }> } };
const loaderOf = (component: unknown) => (component as LazyInternals)._payload._result;

let store: Map<string, string>;
let reload: ReturnType<typeof vi.fn>;
beforeEach(() => {
  store = new Map();
  reload = vi.fn();
  vi.stubGlobal("sessionStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  vi.stubGlobal("window", { location: { reload } });
});
afterEach(() => vi.unstubAllGlobals());

describe("lazyPage", () => {
  it("resolves the named export and clears the reload marker", async () => {
    store.set("kanan-chunk-reload", "1");
    const Page = () => null;
    const component = lazyPage(async () => ({ Page }), "Page");
    await expect(loaderOf(component)()).resolves.toEqual({ default: Page });
    expect(store.has("kanan-chunk-reload")).toBe(false);
  });
  it("reloads once when a page file is missing after a deployment", async () => {
    const component = lazyPage(async (): Promise<{ Page: () => null }> => Promise.reject(new Error("404")), "Page");
    void loaderOf(component)();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(reload).toHaveBeenCalledTimes(1);
    expect(store.get("kanan-chunk-reload")).toBe("1");
  });
  it("does not reload in a loop: a second failure reaches the error boundary", async () => {
    store.set("kanan-chunk-reload", "1");
    const component = lazyPage(async (): Promise<{ Page: () => null }> => Promise.reject(new Error("404")), "Page");
    await expect(loaderOf(component)()).rejects.toThrow("404");
    expect(reload).not.toHaveBeenCalled();
  });
});
