import { execFileSync, spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const SCRIPT = path.join(__dirname, "..", "scripts", "local-refresh.sh");
const hasZsh = spawnSync("zsh", ["-f", "-c", "true"]).status === 0;
const isMac = process.platform === "darwin";
const which = (cmd: string) => path.dirname(execFileSync("/usr/bin/which", [cmd], { encoding: "utf8" }).trim());

const STUBS: Record<string, string> = {
  gh: `#!/bin/zsh -f
print -r -- "gh $*" >> "$CALLS"
case "$*" in
  *"\${GH_FAIL:-__none__}"*) exit 1 ;;
esac
case "$*" in
  "pr list"*) print -r -- "\${GH_OPEN_PR:-}" ;;
  "pr create"*) print -r -- "https://github.com/sandbox/repo/pull/77" ;;
  "issue list"*) print -r -- "\${GH_OPEN_ISSUE:-}" ;;
esac
exit 0
`,
  npm: `#!/bin/zsh -f
print -r -- "npm $*" >> "$CALLS"
if [ "$1" = "ci" ]; then mkdir -p node_modules; exit 0; fi
[ -n "\${STUB_SLEEP:-}" ] && sleep "$STUB_SLEEP"
summary="" result=""
while [ $# -gt 0 ]; do
  case "$1" in --summary) summary="$2"; shift ;; --result) result="$2"; shift ;; esac
  shift
done
print -r -- "# Data refresh (stub)" > "$summary"
if [ "\${STUB_CHANGE:-0}" = "1" ]; then
  print -r -- "changed: $RANDOM" >> data/2026-11/endorsements/x.yml
  print -r -- '{"exitCode":0,"extracted":["x"],"deferred":[],"failed":[],"shrunk":[],"review":['"\${STUB_REVIEW:-}"']}' > "$result"
else
  print -r -- '{"exitCode":0,"extracted":[],"deferred":[],"failed":[],"shrunk":[]}' > "$result"
fi
exit \${STUB_CODE:-0}
`,
  npx: `#!/bin/zsh -f
print -r -- "npx $*" >> "$CALLS"
exit 0
`,
  pdftotext: "#!/bin/zsh -f\nexit 0\n",
  osascript: `#!/bin/zsh -f
print -r -- "osascript $*" >> "$CALLS"
exit 0
`,
};

let sandboxes: string[] = [];
afterEach(() => {
  for (const s of sandboxes) fs.rmSync(s, { recursive: true, force: true });
  sandboxes = [];
});

function setup() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "bb-local-refresh-")));
  sandboxes.push(root);
  const p = (...s: string[]) => path.join(root, ...s);
  for (const d of ["bin", "home", "gh-config", "zdotdir"]) fs.mkdirSync(p(d));
  fs.writeFileSync(p("gitconfig"), "[user]\n\tname = Test\n\temail = test@example.com\n[init]\n\tdefaultBranch = main\n[commit]\n\tgpgsign = false\n");
  for (const [name, body] of Object.entries(STUBS)) fs.writeFileSync(p("bin", name), body, { mode: 0o755 });

  // Never spread process.env here: stray BB_*, GH_TOKEN or GIT_* vars from the real shell would reach the script.
  const env: Record<string, string> = {
    PATH: [p("bin"), which("node"), which("git"), "/usr/bin", "/bin", "/usr/sbin", "/sbin"].join(":"),
    HOME: p("home"),
    TMPDIR: os.tmpdir(),
    LANG: "en_US.UTF-8",
    GIT_CONFIG_GLOBAL: p("gitconfig"),
    GIT_CONFIG_NOSYSTEM: "1",
    GH_CONFIG_DIR: p("gh-config"),
    ZDOTDIR: p("zdotdir"),
    CALLS: p("calls"),
    BB_REPO: "sandbox/repo",
    BB_SOURCE_REPO: p("source"),
    BB_WORKTREE: p("refresh"),
    BB_SUPPORT: p("support"),
    BB_LOG: p("refresh.log"),
    BB_FETCH_RETRY_DELAY: "0",
    BAYBALLOT_LAUNCHD: "1",
  };
  const git = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, env: env as NodeJS.ProcessEnv, encoding: "utf8" });

  git(root, "init", "-q", "--bare", "origin.git");
  fs.mkdirSync(p("seed", "scripts"), { recursive: true });
  fs.mkdirSync(p("seed", "data", "2026-11", "endorsements"), { recursive: true });
  fs.copyFileSync(SCRIPT, p("seed", "scripts", "local-refresh.sh"));
  fs.writeFileSync(p("seed", "package-lock.json"), "{}\n");
  fs.writeFileSync(p("seed", ".gitignore"), "node_modules\n.env*\n");
  fs.writeFileSync(p("seed", "data", "2026-11", "endorsements", "x.yml"), "a: 1\n");
  git(root, "init", "-q", "seed");
  git(p("seed"), "add", ".");
  git(p("seed"), "commit", "-q", "-m", "seed");
  git(p("seed"), "remote", "add", "origin", p("origin.git"));
  git(p("seed"), "push", "-q", "origin", "HEAD:refs/heads/main", "HEAD:refs/heads/feature");
  git(root, "clone", "-q", p("origin.git"), "source");
  fs.writeFileSync(p("source", ".env.local"), "OTHER=1\nBAYBALLOT_ANTHROPIC_API_KEY=sk-test-key\n");
  fs.writeFileSync(p("source", ".git", "hooks", "pre-push"), `#!/bin/sh\nwhile read l ls r rs; do echo "PUSH $r" >> "${p("calls")}"; done\n`, { mode: 0o755 });
  fs.mkdirSync(p("installed"));
  fs.copyFileSync(SCRIPT, p("installed", "local-refresh.sh"));

  const run = (extra: Record<string, string> = {}, args: string[] = [], scriptArg = p("installed", "local-refresh.sh")) => {
    const r = spawnSync("zsh", ["-f", scriptArg, ...args], { cwd: root, env: { ...env, ...extra } as NodeJS.ProcessEnv, encoding: "utf8", timeout: 60_000 });
    const calls = fs.existsSync(p("calls")) ? fs.readFileSync(p("calls"), "utf8").trim().split("\n").filter(Boolean) : [];
    fs.rmSync(p("calls"), { force: true });
    return { code: r.status, out: `${r.stdout}${r.stderr}`, calls };
  };
  const runDetached = (extra: Record<string, string>) =>
    new Promise<{ code: number | null; signal: string | null; calls: string[] }>((resolve) => {
      const child = spawn("zsh", ["-f", p("installed", "local-refresh.sh")], {
        cwd: root, env: { ...env, ...extra } as NodeJS.ProcessEnv, detached: true, stdio: "ignore",
      });
      child.on("exit", (code, signal) => {
        const calls = fs.existsSync(p("calls")) ? fs.readFileSync(p("calls"), "utf8").trim().split("\n").filter(Boolean) : [];
        resolve({ code, signal, calls });
      });
    });
  const runTee = (extra: Record<string, string> = {}) => {
    const { BAYBALLOT_LAUNCHD: _unused, ...rest } = env;
    const r = spawnSync("zsh", ["-f", p("installed", "local-refresh.sh")], { cwd: root, env: { ...rest, ...extra } as NodeJS.ProcessEnv, encoding: "utf8", timeout: 60_000 });
    return { code: r.status, out: `${r.stdout}${r.stderr}` };
  };
  return { root, p, git, run, runDetached, runTee, env };
}

const writes = (calls: string[]) => calls.filter((c) => /^(PUSH|gh pr (create|edit|comment|merge)|gh issue (create|edit|comment|close)|gh label)/.test(c));

describe.skipIf(!hasZsh || !isMac)("local-refresh.sh", () => {
  it("commits, pushes only its branch, opens a PR, notifies, and never touches auto-merge", () => {
    const t = setup();
    const r = t.run({ STUB_CHANGE: "1" });
    expect(r.code).toBe(0);
    expect(r.calls.filter((c) => c.startsWith("PUSH"))).toEqual(["PUSH refs/heads/data/refresh-local"]);
    expect(r.calls.some((c) => c.startsWith("gh pr create") && c.includes("--repo sandbox/repo"))).toBe(true);
    expect(r.calls.filter((c) => c.startsWith("gh pr merge"))).toEqual([]);
    expect(r.calls.some((c) => c.startsWith("gh pr edit") && c.includes("needs-review"))).toBe(false);
    expect(r.calls.find((c) => c.startsWith("osascript"))).toContain("Bay Ballot: local refresh PR #77 ready");
  });

  it("updates the open PR instead of opening another", () => {
    const t = setup();
    t.run({ STUB_CHANGE: "1" });
    const r = t.run({ STUB_CHANGE: "1", GH_OPEN_PR: "77" });
    expect(r.code).toBe(0);
    expect(r.calls.some((c) => c.startsWith("gh pr create"))).toBe(false);
    expect(r.calls.some((c) => c.startsWith("gh pr edit 77 --body-file"))).toBe(true);
    expect(r.calls.filter((c) => c.startsWith("gh pr merge"))).toEqual([]);
  });

  it("labels the PR needs-review when the refresh exits 2, and passes the code through", () => {
    const t = setup();
    const r = t.run({ STUB_CHANGE: "1", STUB_CODE: "2" });
    expect(r.code).toBe(2);
    expect(r.calls.some((c) => c.startsWith("gh pr edit 77 --add-label needs-review"))).toBe(true);
  });

  it("names each review reason from result.json in the needs-review comment", () => {
    const t = setup();
    const r = t.run({ STUB_CHANGE: "1", STUB_CODE: "2", STUB_REVIEW: '"x: unclear-match hold on prop-c: held N, guide now picks Y"' });
    const comment = r.calls.find((c) => c.startsWith("gh pr comment 77 --body Needs review:"));
    expect(comment).toContain("x: unclear-match hold on prop-c: held N, guide now picks Y");
  });

  it("labels the PR needs-review and runs none of its code when its branch changes files outside data/", () => {
    const t = setup();
    t.run({ STUB_CHANGE: "1" });
    t.git(t.p("source"), "fetch", "-q", "origin");
    t.git(t.p("source"), "worktree", "add", "-q", "--detach", t.p("other"), "origin/data/refresh-local");
    fs.writeFileSync(t.p("other", "README.md"), "surprise\n");
    t.git(t.p("other"), "add", "README.md");
    t.git(t.p("other"), "commit", "-q", "-m", "not data");
    t.git(t.p("other"), "push", "-q", "origin", "HEAD:refs/heads/data/refresh-local");
    const r = t.run({ STUB_CHANGE: "1", GH_OPEN_PR: "77" });
    expect(r.code).toBe(1);
    expect(r.out).toContain("not running its code");
    expect(r.calls.some((c) => c.startsWith("gh pr edit 77 --add-label needs-review"))).toBe(true);
    expect(r.calls.some((c) => c.startsWith("gh pr comment 77") && c.includes("README.md"))).toBe(true);
    expect(r.calls.some((c) => c.startsWith("npm"))).toBe(false);
  });

  it("fails loudly if it cannot add the needs-review label", () => {
    const t = setup();
    const r = t.run({ STUB_CHANGE: "1", STUB_CODE: "2", GH_FAIL: "--add-label" });
    expect(r.code).toBe(1);
    expect(r.out).toContain("could not label PR #77 needs-review");
  });

  it("warns in the PR body and notification when the installed script is stale, without blocking", () => {
    const t = setup();
    fs.appendFileSync(t.p("installed", "local-refresh.sh"), "\n# local edit\n");
    const r = t.run({ STUB_CHANGE: "1" });
    expect(r.code).toBe(0);
    expect(r.out).toContain("WARNING: the installed script differs");
    expect(r.calls.find((c) => c.startsWith("osascript"))).toContain("installed script is out of date");
  });

  it("does not report a stale script when run by a relative path", () => {
    const t = setup();
    const r = t.run({ STUB_CHANGE: "1" }, [], "installed/local-refresh.sh");
    expect(r.code).toBe(0);
    expect(r.out).not.toContain("installed script differs");
  });

  it("refuses to run in a worktree that has a branch checked out, before any gh call", () => {
    const t = setup();
    t.git(t.p("source"), "worktree", "add", "-q", "-b", "someone-elses-branch", t.p("refresh"), "origin/main");
    const r = t.run({ STUB_CHANGE: "1" });
    expect(r.code).toBe(1);
    expect(r.out).toContain("has a branch checked out");
    expect(r.calls.filter((c) => c.startsWith("gh"))).toEqual([]);
  });

  it("refuses to run in a worktree with changes outside data/", () => {
    const t = setup();
    t.run();
    fs.writeFileSync(t.p("refresh", "notes.txt"), "someone's work\n");
    const r = t.run({ STUB_CHANGE: "1" });
    expect(r.code).toBe(1);
    expect(r.out).toContain("has changes outside data/");
    expect(fs.existsSync(t.p("refresh", "notes.txt"))).toBe(true);
    expect(r.calls.filter((c) => c.startsWith("gh"))).toEqual([]);
  });

  it("refuses a path that is not a worktree of the source repo", () => {
    const t = setup();
    t.git(t.root, "init", "-q", "refresh");
    const r = t.run();
    expect(r.code).toBe(1);
    expect(writes(r.calls)).toEqual([]);
  });

  it("opens a review issue when the run fails with nothing to commit, and passes the code through", () => {
    const t = setup();
    const r = t.run({ STUB_CODE: "1" });
    expect(r.code).toBe(1);
    expect(r.calls.some((c) => c.startsWith("gh issue create") && c.includes("Local refresh needs review"))).toBe(true);
    expect(r.calls.filter((c) => c.startsWith("PUSH"))).toEqual([]);
  });

  it("does not create a duplicate issue when listing issues fails", () => {
    const t = setup();
    const r = t.run({ STUB_CODE: "1", GH_FAIL: "issue list" });
    expect(r.code).toBe(1);
    expect(r.calls.some((c) => c.startsWith("gh issue create"))).toBe(false);
  });

  it("closes the review issue after a clean run", () => {
    const t = setup();
    const r = t.run({ GH_OPEN_ISSUE: "12" });
    expect(r.code).toBe(0);
    expect(r.calls.some((c) => c.startsWith("gh issue close 12"))).toBe(true);
  });

  it("passes unknown exit codes through", () => {
    const t = setup();
    expect(t.run({ STUB_CODE: "3" }).code).toBe(3);
  });

  it("does nothing when nothing relevant changed", () => {
    const t = setup();
    const r = t.run();
    expect(r.code).toBe(0);
    expect(writes(r.calls)).toEqual([]);
  });

  it("writes only the API key into the worktree's .env.local, private to the user, and never prints it", () => {
    const t = setup();
    const r = t.run();
    expect(fs.readFileSync(t.p("refresh", ".env.local"), "utf8")).toBe("BAYBALLOT_ANTHROPIC_API_KEY=sk-test-key\n");
    expect(fs.statSync(t.p("refresh", ".env.local")).mode & 0o077).toBe(0);
    expect(r.out).not.toContain("sk-test-key");
    expect(fs.readFileSync(t.p("refresh.log"), "utf8")).not.toContain("sk-test-key");
  });

  it("tightens an existing .env.local that others could read", () => {
    const t = setup();
    t.run();
    fs.writeFileSync(t.p("refresh", ".env.local"), "OLD=1\n", { mode: 0o644 });
    fs.chmodSync(t.p("refresh", ".env.local"), 0o644);
    t.run();
    expect(fs.statSync(t.p("refresh", ".env.local")).mode & 0o077).toBe(0);
  });

  it("dry run: no commit, push, PR or issue, and the worktree is left clean", () => {
    const t = setup();
    const r = t.run({ STUB_CHANGE: "1" }, ["--dry-run"]);
    expect(r.code).toBe(0);
    expect(writes(r.calls)).toEqual([]);
    expect(r.calls.some((c) => c.includes("--no-extract"))).toBe(true);
    expect(t.git(t.p("refresh"), "status", "--porcelain").trim()).toBe("");
  });

  it("treats --ref other than origin/main as a dry run", () => {
    const t = setup();
    const r = t.run({ STUB_CHANGE: "1" }, ["--ref", "origin/feature"]);
    expect(r.code).toBe(0);
    expect(writes(r.calls)).toEqual([]);
    expect(r.calls.some((c) => c.includes("--no-extract"))).toBe(true);
  });

  it("runs the Playwright browser install every run", () => {
    const t = setup();
    t.run();
    const r = t.run();
    expect(r.calls).toContain("npx --no-install playwright install chromium");
  });

  it("exits quietly while another run holds the lock, and takes over a dead one's lock", () => {
    const t = setup();
    fs.mkdirSync(t.p("support", "lock"), { recursive: true });
    fs.writeFileSync(t.p("support", "lock", "pid"), `${process.pid}\n`);
    const busy = t.run({ STUB_CHANGE: "1" });
    expect(busy.code).toBe(0);
    expect(busy.calls).toEqual([]);
    fs.writeFileSync(t.p("support", "lock", "pid"), "999999\n");
    const r = t.run({ STUB_CHANGE: "1" });
    expect(r.code).toBe(0);
    expect(r.calls.some((c) => c.startsWith("gh pr create"))).toBe(true);
    expect(fs.existsSync(t.p("support", "lock"))).toBe(false);
  });

  it("treats a fresh lock with no PID yet as busy", () => {
    const t = setup();
    fs.mkdirSync(t.p("support", "lock"), { recursive: true });
    const r = t.run({ STUB_CHANGE: "1" });
    expect(r.code).toBe(0);
    expect(r.calls).toEqual([]);
  });

  it("closes the review issue after a clean run that commits", () => {
    const t = setup();
    const r = t.run({ STUB_CHANGE: "1", GH_OPEN_ISSUE: "12" });
    expect(r.code).toBe(0);
    expect(r.calls.some((c) => c.startsWith("gh issue close 12"))).toBe(true);
  });

  it("refuses to use the source checkout itself as the worktree", () => {
    const t = setup();
    const r = t.run({ BB_WORKTREE: t.p("source") });
    expect(r.code).toBe(1);
    expect(r.out).toContain("not a linked worktree");
    expect(r.calls.filter((c) => c.startsWith("gh"))).toEqual([]);
  });

  it("sends model calls through Claude Code unless BAYBALLOT_MODEL_VIA says api", () => {
    const t = setup();
    const refresh = (calls: string[]) => calls.find((c) => c.startsWith("npm run -s bb -- refresh")) ?? "";
    expect(refresh(t.run().calls)).toContain("--via claude-code");
    expect(refresh(t.run({ BAYBALLOT_MODEL_VIA: "api" }).calls)).toContain("--via api");
    const bad = t.run({ BAYBALLOT_MODEL_VIA: "claude" });
    expect(bad.code).toBe(64);
    expect(bad.calls).toEqual([]);
  });

  it("does not write .env.local on a dry run", () => {
    const t = setup();
    t.run({}, ["--dry-run"]);
    expect(fs.existsSync(t.p("refresh", ".env.local"))).toBe(false);
  });

  it("fails clearly when the source .env.local has no API key line", () => {
    const t = setup();
    fs.writeFileSync(t.p("source", ".env.local"), "OTHER=1\n");
    const r = t.run();
    expect(r.code).toBe(1);
    expect(r.out).toContain("no BAYBALLOT_ANTHROPIC_API_KEY line");
  });

  it("looks only for its PR into main", () => {
    const t = setup();
    const r = t.run();
    expect(r.calls.find((c) => c.startsWith("gh pr list"))).toContain("--base main");
  });

  it("copes with file names that need quoting in the worktree check", () => {
    const t = setup();
    t.run();
    fs.writeFileSync(t.p("refresh", "data", "a \"quoted\" name.txt"), "x\n");
    const r = t.run();
    expect(r.code).toBe(0);
  });

  it("writes its own log when not run by launchd", () => {
    const t = setup();
    const r = t.runTee();
    expect(r.code).toBe(0);
    expect(fs.readFileSync(t.p("refresh.log"), "utf8")).toContain("local refresh starting");
  });

  it("is stopped by the watchdog, notifies, and exits 143", async () => {
    const t = setup();
    const r = await t.runDetached({ BB_WATCHDOG_SECS: "3", STUB_SLEEP: "60" });
    expect(r.code === 143 || r.signal === "SIGTERM").toBe(true);
    expect(r.calls.find((c) => c.startsWith("osascript"))).toContain("local refresh stopped (watchdog or signal)");
  }, 30_000);

  it("passes the saved shrunk state to the refresh", () => {
    const t = setup();
    fs.mkdirSync(t.p("support"), { recursive: true });
    fs.writeFileSync(t.p("support", "shrunk-state.json"), '{"x":"abc"}\n');
    const r = t.run();
    expect(r.calls.some((c) => c.includes(`--shrunk-state ${t.p("support", "shrunk-state.json")}`))).toBe(true);
  });
});
