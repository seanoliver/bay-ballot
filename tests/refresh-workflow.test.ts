import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parse } from "yaml";

type Step = { name?: string; if?: string; run?: string };
const workflow = parse(fs.readFileSync(path.join(__dirname, "..", ".github", "workflows", "refresh.yml"), "utf8"));
const steps: Step[] = workflow.jobs.refresh.steps;
const step = (name: string) => {
  const s = steps.find((x) => x.name === name);
  if (!s?.run) throw new Error(`no step '${name}'`);
  return s as Step & { run: string };
};
const hasBash = spawnSync("bash", ["-c", "true"]).status === 0;

let dirs: string[] = [];
afterEach(() => {
  for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
  dirs = [];
});

function runStep(name: string, env: Record<string, string>, { nodeModules = true, npmCode = 0 } = {}) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "bb-workflow-")));
  dirs.push(root);
  const p = (...s: string[]) => path.join(root, ...s);
  fs.mkdirSync(p("bin"));
  fs.mkdirSync(p("work"));
  if (nodeModules) fs.mkdirSync(p("work", "node_modules"));
  fs.writeFileSync(p("bin", "npm"), `#!/bin/sh\necho "npm $*" >> "${p("calls")}"\nexit ${npmCode}\n`, { mode: 0o755 });
  fs.writeFileSync(p("bin", "curl"), `#!/bin/sh\necho "curl $* stdin: $(cat)" >> "${p("calls")}"\n`, { mode: 0o755 });
  const fullEnv: Record<string, string> = {
    PATH: `${p("bin")}:/usr/bin:/bin`,
    GITHUB_SERVER_URL: "https://github.com", GITHUB_REPOSITORY: "o/r", GITHUB_RUN_ID: "9", RUNNER_TEMP: root,
    BAYBALLOT_NTFY_TOPIC: "bb-topic", CODE: "", PR: "", CHANGES_STEP: "", PR_STEP: "", ISSUE_STEP: "",
    ...env,
  };
  const r = spawnSync("bash", ["--noprofile", "--norc", "-e", "-o", "pipefail", "-c", step(name).run], {
    cwd: p("work"), env: fullEnv as NodeJS.ProcessEnv, encoding: "utf8",
  });
  const calls = fs.existsSync(p("calls")) ? fs.readFileSync(p("calls"), "utf8").trim().split("\n") : [];
  return { code: r.status, out: `${r.stdout}${r.stderr}`, calls };
}

describe.skipIf(!hasBash)("refresh.yml phone notification steps", () => {
  it("run whenever the run did not stop on a conflict, even if a setup step failed", () => {
    expect(step("Send the phone notification").if).toBe("always() && steps.base.outputs.stop != 'true'");
    expect(step("Record the run on the runs branch").if).toBe("always() && steps.base.outputs.stop != 'true'");
    expect(step("Send a phone notification when the refresh branch conflicts with main").if).toBe("always() && steps.base.outputs.stop == 'true'");
  });

  it("pass --failed when a step after the refresh failed", () => {
    const r = runStep("Send the phone notification", { CODE: "0", PR: "12", PR_STEP: "failure", ISSUE_STEP: "failure" });
    expect(r.code).toBe(0);
    expect(r.calls).toHaveLength(1);
    expect(r.calls[0]).toContain("--click https://github.com/o/r/pull/12");
    expect(r.calls[0]).toContain("--failed the commit, push or PR step failed; the review issue step failed");
  });

  it("pass no --failed on a run whose steps all succeeded", () => {
    const r = runStep("Send the phone notification", { CODE: "0", CHANGES_STEP: "success", PR_STEP: "skipped", ISSUE_STEP: "success" });
    expect(r.calls[0]).not.toContain("--failed");
    expect(r.calls[0]).toContain("--crashed");
  });

  it("fall back to a curl crash push when bb can't run, without the topic on the command line", () => {
    for (const opts of [{ nodeModules: false }, { npmCode: 1 }]) {
      const r = runStep("Send the phone notification", {}, opts);
      expect(r.code).toBe(0);
      const [args, stdin] = (r.calls.find((c) => c.startsWith("curl")) ?? "").split(" stdin: ");
      expect(args).toContain("Title: Bay Ballot refresh crashed before the run");
      expect(args).toContain("Priority: 5");
      expect(args).toContain("Click: https://github.com/o/r/actions/runs/9");
      expect(args).not.toContain("bb-topic");
      expect(stdin).toBe('url = "https://ntfy.sh/bb-topic"');
    }
  });

  it("send nothing from the fallback when no topic is set", () => {
    const r = runStep("Send the phone notification", { BAYBALLOT_NTFY_TOPIC: "" }, { nodeModules: false });
    expect(r.code).toBe(0);
    expect(r.calls).toEqual([]);
  });

  it("post the conflict push with curl, not bb", () => {
    const r = runStep("Send a phone notification when the refresh branch conflicts with main", { PR: "12" }, { nodeModules: false });
    expect(r.code).toBe(0);
    expect(r.calls).toHaveLength(1);
    const [args, stdin] = r.calls[0].split(" stdin: ");
    expect(args).toContain("Priority: 3");
    expect(args).toContain("Click: https://github.com/o/r/pull/12");
    expect(args).toContain("conflicts with main");
    expect(stdin).toBe('url = "https://ntfy.sh/bb-topic"');
  });
});
