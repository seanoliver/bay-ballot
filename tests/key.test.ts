import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeClient, resolveApiKey } from "@/pipeline/key";

const MSG = "Set BAYBALLOT_ANTHROPIC_API_KEY in .env.local";
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "bb-key-"));

afterEach(() => vi.unstubAllEnvs());

describe("resolveApiKey", () => {
  it("throws when the file is missing", () => {
    expect(() => resolveApiKey(path.join(tmp(), ".env.local"))).toThrow(MSG);
  });

  it("never falls back to ANTHROPIC_API_KEY", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-work-key");
    vi.stubEnv("BAYBALLOT_ANTHROPIC_API_KEY", "sk-from-shell");
    const f = path.join(tmp(), ".env.local");
    fs.writeFileSync(f, "OTHER=1\n");
    expect(() => resolveApiKey(f)).toThrow(MSG);
  });

  it("throws on an empty value", () => {
    const f = path.join(tmp(), ".env.local");
    fs.writeFileSync(f, "BAYBALLOT_ANTHROPIC_API_KEY=\n");
    expect(() => resolveApiKey(f)).toThrow(MSG);
  });

  it("returns the key from the file", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-work-key");
    const f = path.join(tmp(), ".env.local");
    fs.writeFileSync(f, "# personal key\nBAYBALLOT_ANTHROPIC_API_KEY=\"sk-personal\"\n");
    expect(resolveApiKey(f)).toBe("sk-personal");
  });
});

describe("makeClient", () => {
  it("ignores base URL and auth token from the environment", () => {
    vi.stubEnv("ANTHROPIC_BASE_URL", "https://proxy.example.com");
    vi.stubEnv("ANTHROPIC_AUTH_TOKEN", "work-token");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-work-key");
    const client = makeClient("sk-personal");
    expect(client.baseURL).toBe("https://api.anthropic.com");
    expect(client.authToken).toBeNull();
    expect(client.apiKey).toBe("sk-personal");
  });
});
