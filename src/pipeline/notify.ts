import { CRASHED, readReport, type ReportJson } from "./report";

type Env = Record<string, string | undefined>;
type Fetch = (url: string, init: RequestInit) => Promise<Response>;

/** A phone push: ntfy's priority 2 is low (no sound), 3 default, 5 urgent. */
export type Push = { title: string; priority: 2 | 3 | 5; tags: string; body: string };

const CONFLICT = "The refresh branch conflicts with main, so the run stopped without refreshing. Resolve it by hand.";
// ntfy turns a larger message into an attachment.
const MAX_BODY = 4000;

export function pushFor(report: ReportJson | null, { scope, conflict = false }: { scope: "cloud" | "local"; conflict?: boolean }): Push {
  const prefix = scope === "local" ? "Local " : "";
  if (conflict) return { title: `${prefix}Bay Ballot refresh: needs review`, priority: 3, tags: "eyes", body: CONFLICT };
  if (!report) return { title: `${prefix}ALERT: ${CRASHED}`, priority: 5, tags: "rotating_light", body: CRASHED };
  const body = [report.digest, ...(report.alerts.length ? ["", ...report.alerts.map((a) => `${a.level}: ${a.text}`)] : [])].join("\n").slice(0, MAX_BODY);
  const high = report.alerts.find((a) => a.level === "high");
  if (high) return { title: `${prefix}ALERT: ${high.text}`, priority: 5, tags: "rotating_light", body };
  if (report.alerts.length) return { title: `${prefix}Bay Ballot refresh: needs review`, priority: 3, tags: "eyes", body };
  return { title: `${prefix}Bay Ballot refresh: clean`, priority: 2, tags: "white_check_mark", body };
}

// Header values must be ASCII for fetch; ntfy decodes RFC 2047 encoded words.
const headerText = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s).toString("base64")}?=`);

export type NotifyOptions = {
  resultPath?: string;
  scope: "cloud" | "local";
  click?: string;
  crashed?: boolean;
  conflict?: boolean;
  env?: Env;
  fetch?: Fetch;
  log?: (line: string) => void;
};

/** Sends the run's push through ntfy. Never throws: a failed notification must not fail the run. */
export async function notify(opts: NotifyOptions): Promise<"sent" | "off" | "failed"> {
  const env = opts.env ?? process.env;
  const log = opts.log ?? ((l: string) => console.warn(l));
  const topic = env.BAYBALLOT_NTFY_TOPIC?.trim();
  if (!topic) {
    log("BAYBALLOT_NTFY_TOPIC is not set; phone notifications are off.");
    return "off";
  }
  const server = (env.BAYBALLOT_NTFY_SERVER?.trim() || "https://ntfy.sh").replace(/\/+$/, "");
  const report = opts.crashed || opts.conflict || !opts.resultPath ? null : readReport(opts.resultPath);
  const push = pushFor(report, { scope: opts.scope, conflict: opts.conflict });
  try {
    const res = await (opts.fetch ?? fetch)(`${server}/${topic}`, {
      method: "POST",
      body: push.body,
      headers: { Title: headerText(push.title), Priority: String(push.priority), Tags: push.tags, ...(opts.click ? { Click: opts.click } : {}) },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      log(`warning: the phone notification was refused: HTTP ${res.status}`);
      return "failed";
    }
    return "sent";
  } catch (e) {
    log(`warning: could not send the phone notification: ${e instanceof Error ? e.message : String(e)}`);
    return "failed";
  }
}
