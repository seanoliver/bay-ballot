import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SCRIPT = path.join(__dirname, "..", "scripts", "local-refresh.sh");
const hasZsh = spawnSync("zsh", ["-c", "true"]).status === 0;
const isMac = process.platform === "darwin";

const STUBS: Record<string, string> = {
  gh: `#!/bin/zsh
print -r -- "gh $*" >> "$CALLS"
case "$*" in
  "pr list"*) print -r -- "\${GH_OPEN_PR:-}" ;;
  "pr create"*) print -r -- "https://github.com/seanoliver/bay-ballot/pull/77" ;;
  "pr view"*) print -r -- "\${GH_LABELS:-}" ;;
  "api repos/"*"/rules/branches/main"*) print -r -- "\${GH_REQUIRES_CI:-true}" ;;
  "issue list"*) print -r -- "" ;;
esac
exit 0
`,
  npm: `#!/bin/zsh
print -r -- "npm $*" >> "$CALLS"
if [ "$1" = "ci" ]; then mkdir -p node_modules; exit 0; fi
summary="" result=""
while [ $# -gt 0 ]; do
  case "$1" in --summary) summary="$2"; shift ;; --result) result="$2"; shift ;; esac
  shift
done
print -r -- "# Data refresh (stub)" > "$summary"
if [ "\${STUB_CHANGE:-0}" = "1" ]; then
  print -r -- "changed: $RANDOM" >> data/2026-11/endorsements/x.yml
  print -r -- '{"exitCode":0,"extracted":["x"],"deferred":[],"failed":[],"shrunk":[]}' > "$result"
else
  print -r -- '{"exitCode":0,"extracted":[],"deferred":[],"failed":[],"shrunk":[]}' > "$result"
fi
exit \${STUB_CODE:-0}
`,
  npx: `#!/bin/zsh
print -r -- "npx $*" >> "$CALLS"
exit 0
`,
  pdftotext: `#!/bin/zsh
exit 0
`,
};

type Env = Record<string, string | undefined>;

function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bb-local-refresh-"));
  const p = (...s: string[]) => path.join(root, ...s);
  fs.writeFileSync(p("gitconfig"), "[user]\n\tname = Test\n\temail = test@example.com\n[init]\n\tdefaultBranch = main\n");
  const env: Env = {
    ...process.env,
    // Keep HOME in the sandbox: the script's default paths point at real checkouts under ~.
    HOME: root,
    GIT_CONFIG_GLOBAL: p("gitconfig"),
    GIT_CONFIG_NOSYSTEM: "1",
    PATH: `${p("bin")}:${process.env.PATH}`,
    CALLS: p("calls"),
    BB_SOURCE_REPO: p("source"),
    BB_WORKTREE: p("refresh"),
    BB_SUPPORT: p("support"),
    BB_LOG: p("refresh.log"),
    BB_NOTIFY: "0",
    BB_FETCH_RETRY_DELAY: "0",
    BAYBALLOT_LAUNCHD: "1",
  };
  const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-c", "commit.gpgsign=false", ...args], { cwd, env: env as NodeJS.ProcessEnv, encoding: "utf8" });

  fs.mkdirSync(p("bin"));
  for (const [name, body] of Object.entries(STUBS)) fs.writeFileSync(p("bin", name), body, { mode: 0o755 });

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
  git(p("seed"), "push", "-q", "origin", "HEAD:refs/heads/main");
  git(root, "clone", "-q", p("origin.git"), "source");
  fs.writeFileSync(p("source", ".env.local"), "OTHER=1\nBAYBALLOT_ANTHROPIC_API_KEY=sk-test-key\n");
  fs.writeFileSync(p("source", ".git", "hooks", "pre-push"), `#!/bin/sh\necho "PUSH $2" >> "${p("calls")}"\n`, { mode: 0o755 });
  fs.mkdirSync(p("installed"));
  fs.copyFileSync(SCRIPT, p("installed", "local-refresh.sh"));

  const run = (extra: Env = {}, args: string[] = []) => {
    const r = spawnSync("zsh", [p("installed", "local-refresh.sh"), ...args], { cwd: root, env: { ...env, ...extra } as NodeJS.ProcessEnv, encoding: "utf8" });
    const calls = fs.existsSync(p("calls")) ? fs.readFileSync(p("calls"), "utf8").trim().split("\n").filter(Boolean) : [];
    fs.rmSync(p("calls"), { force: true });
    return { code: r.status, out: `${r.stdout}${r.stderr}`, calls };
  };
  return { root, p, git, run, env };
}

const merges = (calls: string[]) => calls.filter((c) => c.startsWith("gh pr merge"));

describe.skipIf(!hasZsh || !isMac)("local-refresh.sh", () => {
  it("commits, opens a PR and arms auto-merge pinned to the pushed commit when every guard passes", () => {
    const t = setup();
    const r = t.run({ STUB_CHANGE: "1" });
    expect(r.code).toBe(0);
    expect(r.calls).toContain("PUSH https://placeholder".replace("https://placeholder", t.p("origin.git")));
    expect(r.calls.some((c) => c.startsWith("gh pr create") && c.includes("--repo seanoliver/bay-ballot"))).toBe(true);
    const head = t.git(t.p("origin.git"), "rev-parse", "refs/heads/data/refresh-local").trim();
    expect(merges(r.calls)).toEqual([`gh pr merge 77 --auto --squash --delete-branch --match-head-commit ${head} --repo seanoliver/bay-ballot`]);
  });

  it("disarms auto-merge on an existing PR before pushing", () => {
    const t = setup();
    t.run({ STUB_CHANGE: "1" });
    const r = t.run({ STUB_CHANGE: "1", GH_OPEN_PR: "77" });
    const disarm = r.calls.findIndex((c) => c.startsWith("gh pr merge 77 --disable-auto"));
    const push = r.calls.findIndex((c) => c.startsWith("PUSH"));
    expect(disarm).toBeGreaterThanOrEqual(0);
    expect(push).toBeGreaterThan(disarm);
    expect(merges(r.calls).at(-1)).toContain("--auto --squash");
  });

  it("holds the PR with auto-merge off when the refresh exits 2, and passes the code through", () => {
    const t = setup();
    const r = t.run({ STUB_CHANGE: "1", STUB_CODE: "2" });
    expect(r.code).toBe(2);
    expect(merges(r.calls).every((c) => !c.includes("--auto"))).toBe(true);
    expect(r.calls).toContain("gh pr merge 77 --disable-auto --repo seanoliver/bay-ballot");
    expect(r.calls.some((c) => c.startsWith("gh pr edit 77 --add-label needs-review"))).toBe(true);
    expect(r.calls.some((c) => c.startsWith("gh pr comment 77") && c.includes("refresh exit code 2"))).toBe(true);
  });

  it("refuses auto-merge when main's ruleset doesn't require ci", () => {
    const t = setup();
    const r = t.run({ STUB_CHANGE: "1", GH_REQUIRES_CI: "false" });
    expect(r.code).toBe(2);
    expect(merges(r.calls).every((c) => !c.includes("--auto"))).toBe(true);
    expect(r.calls.some((c) => c.startsWith("gh pr comment") && c.includes("does not require the ci check"))).toBe(true);
  });

  it("refuses auto-merge when the PR is already labeled needs-review", () => {
    const t = setup();
    const r = t.run({ STUB_CHANGE: "1", GH_LABELS: "needs-review" });
    expect(r.code).toBe(2);
    expect(merges(r.calls).every((c) => !c.includes("--auto"))).toBe(true);
  });

  it("refuses auto-merge when the installed script differs from main's", () => {
    const t = setup();
    fs.appendFileSync(t.p("installed", "local-refresh.sh"), "\n# local edit\n");
    const r = t.run({ STUB_CHANGE: "1" });
    expect(r.code).toBe(2);
    expect(r.out).toContain("WARNING: the installed script differs");
    expect(merges(r.calls).every((c) => !c.includes("--auto"))).toBe(true);
  });

  it("refuses auto-merge when the PR branch has changes outside data/", () => {
    const t = setup();
    t.run({ STUB_CHANGE: "1" });
    t.git(t.p("source"), "fetch", "-q", "origin");
    t.git(t.p("source"), "worktree", "add", "-q", "--detach", t.p("evil"), "origin/data/refresh-local");
    fs.writeFileSync(t.p("evil", "README.md"), "surprise\n");
    t.git(t.p("evil"), "add", "README.md");
    t.git(t.p("evil"), "commit", "-q", "-m", "not data");
    t.git(t.p("evil"), "push", "-q", "origin", "HEAD:refs/heads/data/refresh-local");
    const r = t.run({ STUB_CHANGE: "1", GH_OPEN_PR: "77" });
    expect(r.code).toBe(2);
    expect(r.calls.some((c) => c.startsWith("gh pr comment") && c.includes("files outside data/: README.md"))).toBe(true);
    expect(merges(r.calls).every((c) => !c.includes("--auto"))).toBe(true);
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
    expect(r.out).toMatch(/different repository|has a branch checked out/);
  });

  it("opens a review issue when the run fails with nothing to commit, and passes the exit code through", () => {
    const t = setup();
    const r = t.run({ STUB_CODE: "1" });
    expect(r.code).toBe(1);
    expect(r.calls.some((c) => c.startsWith("gh issue create") && c.includes("Local refresh needs review"))).toBe(true);
    expect(r.calls.filter((c) => c.startsWith("PUSH"))).toEqual([]);
  });

  it("passes unknown exit codes through", () => {
    const t = setup();
    expect(t.run({ STUB_CODE: "3" }).code).toBe(3);
  });

  it("does nothing when nothing relevant changed", () => {
    const t = setup();
    const r = t.run();
    expect(r.code).toBe(0);
    expect(r.calls.filter((c) => c.startsWith("PUSH") || c.startsWith("gh issue") || c.startsWith("gh pr create"))).toEqual([]);
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
    fs.writeFileSync(t.p("refresh", ".env.local"), "OLD=1\nBAYBALLOT_ANTHROPIC_API_KEY=old\n", { mode: 0o644 });
    fs.chmodSync(t.p("refresh", ".env.local"), 0o644);
    t.run();
    expect(fs.statSync(t.p("refresh", ".env.local")).mode & 0o077).toBe(0);
    expect(fs.readFileSync(t.p("refresh", ".env.local"), "utf8")).toBe("BAYBALLOT_ANTHROPIC_API_KEY=sk-test-key\n");
  });

  it("dry run: no commit, push, PR or issue, and the worktree is left clean", () => {
    const t = setup();
    const r = t.run({ STUB_CHANGE: "1" }, ["--dry-run"]);
    expect(r.code).toBe(0);
    expect(r.calls.filter((c) => /^(PUSH|gh pr (create|edit|comment|merge)|gh issue)/.test(c))).toEqual([]);
    expect(r.calls.some((c) => c.includes("--no-extract"))).toBe(true);
    expect(t.git(t.p("refresh"), "status", "--porcelain").trim()).toBe("");
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

  it("passes the saved shrunk state to the refresh", () => {
    const t = setup();
    fs.mkdirSync(t.p("support"), { recursive: true });
    fs.writeFileSync(t.p("support", "shrunk-state.json"), '{"x":"abc"}\n');
    const r = t.run();
    expect(r.calls.some((c) => c.includes(`--shrunk-state ${t.p("support", "shrunk-state.json")}`))).toBe(true);
  });
});
