import { test } from "node:test";
import assert from "node:assert/strict";
import { deploymentConfig } from "./build-vercel.mjs";
test("API proxy precedes SPA fallback, retains private paths and forbids CDN caching", () => {
  const { routes } = deploymentConfig({ BACKEND_ORIGIN: "https://api.example.test" });
  const api = routes.find(r => r.dest?.startsWith("https://")),
    spa = routes.at(-1);
  for (const path of ["/api", "/api/auth/login", "/api/media/private-key", "/api/results/123"]) {
    assert.match(path, new RegExp(api.src));
    assert.doesNotMatch(path, new RegExp(spa.src));
    assert.equal(path.replace(new RegExp(api.src), api.dest), `https://api.example.test${path}`);
  }
  assert.equal(api.headers["Cache-Control"], "no-store");
  assert.equal(api.headers["x-vercel-enable-rewrite-caching"], "0");
  for (const path of ["/admin/results", "/student/tests", "/trainer/dashboard"])
    assert.match(path, new RegExp(spa.src));
  assert.ok(routes.indexOf(api) < routes.findIndex(r => r.handle === "filesystem"));
});
test("deployment fails before building when API origin is absent, unsafe or demo mode is enabled", () => {
  for (const value of [
    undefined,
    "http://api.example.test",
    "https://localhost",
    "https://127.0.0.1",
    "https://api.example.test/api",
    "https://user:secret@api.example.test",
    "https://api.example.test?secret=x",
  ])
    assert.throws(() => deploymentConfig({ BACKEND_ORIGIN: value }));
  assert.throws(() => deploymentConfig({ BACKEND_ORIGIN: "https://api.example.test", VITE_DEMO_MODE: "true" }));
  assert.doesNotThrow(() => deploymentConfig({ BACKEND_ORIGIN: "https://api.example.test/", VITE_DEMO_MODE: "false" }));
});
test("pages get a strict content security policy without wildcard media or inline style elements", () => {
  const headers = deploymentConfig({ BACKEND_ORIGIN: "https://api.example.test" }).routes[0].headers;
  const csp = headers["Content-Security-Policy"];
  const directive = name =>
    csp
      .split(";")
      .map(d => d.trim())
      .find(d => d.startsWith(`${name} `)) ?? "";
  assert.equal(directive("media-src"), "media-src 'self' blob:");
  assert.ok(!/(^|\s)https:(\s|$)/.test(csp), csp);
  assert.ok(!directive("style-src").includes("unsafe-inline"));
  assert.ok(!directive("style-src-elem").includes("unsafe-inline"));
  assert.equal(directive("style-src-attr"), "style-src-attr 'unsafe-inline'");
  assert.equal(directive("frame-ancestors"), "frame-ancestors 'none'");
});
