import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const SCRIPT = path.join(__dirname, "..", "scripts", "append-run.sh");
const hasBash = spawnSync("bash", ["-c", "true"]).status === 0;
const REAL_GIT = execFileSync("/usr/bin/which", ["git"], { encoding: "utf8" }).trim();

let sandboxes: string[] = [];
afterEach(() => {
  for (const s of sandboxes) fs.rmSync(s, { recursive: true, force: true });
  sandboxes = [];
});

function setup() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "bb-append-run-")));
  sandboxes.push(root);
  const p = (...s: string[]) => path.join(root, ...s);
  fs.mkdirSync(p("bin"));
  fs.writeFileSync(p("gitconfig"), "[user]\n\tname = Caller\n\temail = caller@example.com\n[init]\n\tdefaultBranch = main\n[commit]\n\tgpgsign = false\n");
  // Never spread process.env here: stray GIT_* vars from the real shell would reach the script.
  const env: Record<string, string> = {
    PATH: [p("bin"), path.dirname(REAL_GIT), "/usr/bin", "/bin"].join(":"),
    HOME: root,
    TMPDIR: os.tmpdir(),
    GIT_CONFIG_GLOBAL: p("gitconfig"),
    GIT_CONFIG_NOSYSTEM: "1",
  };
  const git = (cwd: string, ...args: string[]) => execFileSync(REAL_GIT, args, { cwd, env: env as NodeJS.ProcessEnv, encoding: "utf8" }).trim();

  git(root, "init", "-q", "--bare", "origin.git");
  git(root, "init", "-q", "caller");
  fs.writeFileSync(p("caller", "a.txt"), "main\n");
  git(p("caller"), "add", ".");
  git(p("caller"), "commit", "-q", "-m", "main");
  git(p("caller"), "remote", "add", "origin", p("origin.git"));
  git(p("caller"), "push", "-q", "origin", "HEAD:refs/heads/main");
  git(p("caller"), "switch", "-q", "-c", "data/refresh");
  fs.writeFileSync(p("caller", "a.txt"), "staged\n");
  git(p("caller"), "add", "a.txt");
  fs.writeFileSync(p("caller", "notes.txt"), "untracked\n");

  let n = 0;
  const run = (record: object | string = { n: ++n }, extra: Record<string, string> = {}, remote = p("origin.git")) => {
    const file = p(`record-${Math.random()}.json`);
    fs.writeFileSync(file, typeof record === "string" ? record : `${JSON.stringify(record)}\n`);
    const r = spawnSync("bash", [SCRIPT, file, remote, "Run Bot", "bot@example.com"], { cwd: p("caller"), env: { ...env, ...extra } as NodeJS.ProcessEnv, encoding: "utf8", timeout: 60_000 });
    return { code: r.status, out: `${r.stdout}${r.stderr}` };
  };
  const runs = () => git(root, "--git-dir", p("origin.git"), "show", "runs:runs.ndjson").split("\n").map((l) => JSON.parse(l));
  const callerState = () => [
    git(p("caller"), "symbolic-ref", "HEAD"),
    git(p("caller"), "status", "--porcelain"),
    git(p("caller"), "diff", "--cached"),
    git(p("caller"), "branch", "--list"),
  ];
  return { root, p, git, run, runs, callerState, env };
}

describe.skipIf(!hasBash)("append-run.sh", () => {
  it("creates the orphan runs branch with a README and the first line", () => {
    const t = setup();
    const before = t.callerState();
    const r = t.run({ date: "2026-10-10", scope: "cloud" });
    expect(r.code).toBe(0);
    expect(t.runs()).toEqual([{ date: "2026-10-10", scope: "cloud" }]);
    const origin = (...a: string[]) => t.git(t.root, "--git-dir", t.p("origin.git"), ...a);
    expect(origin("ls-tree", "--name-only", "runs").split("\n")).toEqual(["README.md", "runs.ndjson"]);
    expect(origin("rev-list", "--count", "runs")).toBe("1");
    expect(origin("log", "-1", "--format=%an <%ae>", "runs")).toBe("Run Bot <bot@example.com>");
    expect(t.callerState()).toEqual(before);
    expect(fs.readFileSync(t.p("caller", "notes.txt"), "utf8")).toBe("untracked\n");
  });

  it("appends to an existing runs branch", () => {
    const t = setup();
    t.run({ n: 1 });
    const before = t.callerState();
    const r = t.run({ n: 2 });
    expect(r.code).toBe(0);
    expect(t.runs()).toEqual([{ n: 1 }, { n: 2 }]);
    expect(t.git(t.root, "--git-dir", t.p("origin.git"), "rev-list", "--count", "runs")).toBe("2");
    expect(t.callerState()).toEqual(before);
    expect(t.git(t.root, "--git-dir", t.p("origin.git"), "rev-parse", "main")).toBe(t.git(t.p("caller"), "rev-parse", "origin/main"));
  });

  it("retries when another job pushes between its fetch and its push", () => {
    const t = setup();
    t.run({ n: 1 });
    t.git(t.root, "clone", "-q", "--branch", "runs", t.p("origin.git"), "other");
    fs.appendFileSync(t.p("other", "runs.ndjson"), `${JSON.stringify({ n: "other" })}\n`);
    t.git(t.p("other"), "commit", "-q", "-am", "other job");
    fs.writeFileSync(t.p("bin", "git"), `#!/bin/sh
case " $* " in *" push "*)
  if [ ! -e "${t.p("raced")}" ]; then : > "${t.p("raced")}"; "${REAL_GIT}" -C "${t.p("other")}" push -q origin HEAD:refs/heads/runs; fi ;;
esac
exec "${REAL_GIT}" "$@"
`, { mode: 0o755 });
    const r = t.run({ n: 2 });
    expect(r.code).toBe(0);
    expect(fs.existsSync(t.p("raced"))).toBe(true);
    expect(r.out).toContain("retrying");
    expect(t.runs()).toEqual([{ n: 1 }, { n: "other" }, { n: 2 }]);
  });

  it("warns and exits 0 when the remote can't be reached or the record is bad", () => {
    const t = setup();
    const unreachable = t.run({ n: 1 }, {}, t.p("no-such-remote.git"));
    expect(unreachable.code).toBe(0);
    expect(unreachable.out).toContain("warning: could not record the run history");
    const bad = t.run("not json\n");
    expect(bad.code).toBe(0);
    expect(bad.out).toContain("not one JSON object");
    expect(t.git(t.root, "--git-dir", t.p("origin.git"), "branch", "--list", "runs")).toBe("");
  });
});
