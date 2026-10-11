import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const SCRIPT = path.join(__dirname, "..", "scripts", "local-refresh-launchd.sh");
const hasZsh = spawnSync("zsh", ["-f", "-c", "true"]).status === 0;
const isMac = process.platform === "darwin";
const which = (cmd: string) => path.dirname(execFileSync("/usr/bin/which", [cmd], { encoding: "utf8" }).trim());
const TOPIC = "bb-secret-topic-0123";

let sandboxes: string[] = [];
afterEach(() => {
  for (const s of sandboxes) fs.rmSync(s, { recursive: true, force: true });
  sandboxes = [];
});

function setup() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "bb-launchd-")));
  sandboxes.push(root);
  const p = (...s: string[]) => path.join(root, ...s);
  fs.mkdirSync(p("bin"));
  fs.mkdirSync(p("home"));
  for (const cmd of ["npm", "npx", "gh", "pdftotext", "launchctl"]) fs.writeFileSync(p("bin", cmd), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  const plist = p("home", "Library", "LaunchAgents", "com.bayballot.local-refresh.plist");
  const install = (extra: Record<string, string> = {}) => {
    const env: Record<string, string> = { PATH: [p("bin"), which("node"), which("git"), "/usr/bin", "/bin"].join(":"), HOME: p("home"), TMPDIR: os.tmpdir(), ...extra };
    const r = spawnSync("zsh", ["-f", SCRIPT, "install"], { env: env as NodeJS.ProcessEnv, encoding: "utf8" });
    return { code: r.status, out: `${r.stdout}${r.stderr}` };
  };
  const envVar = (name: string) => {
    const r = spawnSync("plutil", ["-extract", `EnvironmentVariables.${name}`, "raw", "-o", "-", plist], { encoding: "utf8" });
    return r.status === 0 ? r.stdout.trim() : null;
  };
  return { install, topic: () => envVar("BAYBALLOT_NTFY_TOPIC"), envVar };
}

describe.skipIf(!hasZsh || !isMac)("local-refresh-launchd.sh install", { timeout: 20_000 }, () => {
  it("records the topic from the shell", () => {
    const t = setup();
    const r = t.install({ BAYBALLOT_NTFY_TOPIC: TOPIC });
    expect(r.code).toBe(0);
    expect(t.topic()).toBe(TOPIC);
    expect(r.out).not.toContain(TOPIC);
  });

  it("keeps the installed topic when reinstalled from a shell without it, and says so without printing it", () => {
    const t = setup();
    t.install({ BAYBALLOT_NTFY_TOPIC: TOPIC });
    const r = t.install();
    expect(r.code).toBe(0);
    expect(t.topic()).toBe(TOPIC);
    expect(r.out).toContain("Kept BAYBALLOT_NTFY_TOPIC from the installed job.");
    expect(r.out).not.toContain(TOPIC);
  });

  it("keeps the installed ntfy server when reinstalled from a shell without it", () => {
    const t = setup();
    t.install({ BAYBALLOT_NTFY_TOPIC: TOPIC, BAYBALLOT_NTFY_SERVER: "https://ntfy.example.org" });
    const r = t.install();
    expect(r.code).toBe(0);
    expect(t.envVar("BAYBALLOT_NTFY_SERVER")).toBe("https://ntfy.example.org");
    expect(r.out).toContain("Kept BAYBALLOT_NTFY_SERVER from the installed job.");
    expect(t.install({ BAYBALLOT_NTFY_SERVER: "https://ntfy.other.org" }).code).toBe(0);
    expect(t.envVar("BAYBALLOT_NTFY_SERVER")).toBe("https://ntfy.other.org");
  });

  it("says phone notifications are off when neither the shell nor the installed job has a topic", () => {
    const t = setup();
    const r = t.install();
    expect(r.code).toBe(0);
    expect(t.topic()).toBeNull();
    expect(r.out).toContain("Phone notifications are off: set BAYBALLOT_NTFY_TOPIC and re-run install");
  });
});
