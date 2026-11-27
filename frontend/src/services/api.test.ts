import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError, setCsrf, setReauthHandler } from "./api";

type Call = { url: string; init: RequestInit };
let calls: Call[];
const respond = (...responses: Array<{ status: number; body: unknown }>) => {
  calls = [];
  const queue = [...responses];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      const next = queue.shift()!;
      return new Response(JSON.stringify(next.body), { status: next.status });
    }),
  );
};
const headers = (call: Call) => call.init.headers as Record<string, string>;

beforeEach(() => {
  vi.stubGlobal("window", new EventTarget());
  setCsrf("csrf-token");
  setReauthHandler(undefined);
});
afterEach(() => vi.unstubAllGlobals());

describe("api client", () => {
  it("sends reads without a CSRF token and writes with it", async () => {
    respond({ status: 200, body: { ok: 1 } }, { status: 200, body: { ok: 2 } });
    expect(await api("/bootstrap")).toEqual({ ok: 1 });
    await api("/student/goals", { method: "PUT", body: { targetBand: 7 } });
    expect(calls[0]!.url).toBe("/api/bootstrap");
    expect(headers(calls[0]!)["X-CSRF-Token"]).toBeUndefined();
    expect(headers(calls[1]!)["X-CSRF-Token"]).toBe("csrf-token");
    expect(headers(calls[1]!)["Content-Type"]).toBe("application/json");
    expect(calls[1]!.init.body).toBe(JSON.stringify({ targetBand: 7 }));
    expect(calls[1]!.init.credentials).toBe("same-origin");
  });
  it("asks for the password once and retries when the server requires confirmation", async () => {
    const reauth = vi.fn(async () => {});
    setReauthHandler(reauth);
    respond(
      { status: 403, body: { code: "REAUTH_REQUIRED", message: "Confirm" } },
      { status: 200, body: { done: true } },
    );
    expect(await api("/admin/settings", { method: "PUT", body: {} })).toEqual({ done: true });
    expect(reauth).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(2);
  });
  it("does not loop when confirmation is required again", async () => {
    setReauthHandler(async () => {});
    respond(
      { status: 403, body: { code: "REAUTH_REQUIRED", message: "Confirm your password" } },
      { status: 403, body: { code: "REAUTH_REQUIRED", message: "Confirm your password" } },
    );
    await expect(api("/admin/settings", { method: "PUT", body: {} })).rejects.toThrow("Confirm your password");
    expect(calls).toHaveLength(2);
  });
  it("announces an expired session, except on sign-in routes", async () => {
    const expired = vi.fn();
    window.addEventListener("kanan-session-expired", expired);
    respond({ status: 401, body: { message: "Sign in to continue" } }, { status: 401, body: { message: "Wrong" } });
    await expect(api("/bootstrap")).rejects.toBeInstanceOf(ApiError);
    await expect(api("/auth/login", { method: "POST", body: {} })).rejects.toThrow("Wrong");
    expect(expired).toHaveBeenCalledTimes(1);
  });
  it("turns field errors into one readable message with the status", async () => {
    respond({
      status: 400,
      body: {
        message: "Check the submitted fields",
        issues: [{ path: "name", message: "Required" }, { message: "Bad" }],
      },
    });
    const error = (await api("/admin/students/x", { method: "PUT", body: {} }).catch(e => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe("name: Required. Bad");
    expect(error.status).toBe(400);
  });
  it("reports a non-JSON server response clearly", async () => {
    calls = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>Bad gateway</html>", { status: 502 })),
    );
    await expect(api("/bootstrap")).rejects.toThrow("The server returned an unexpected response");
  });
});
