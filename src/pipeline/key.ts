import fs from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { parseEnv } from "node:util";

const VAR = "BAYBALLOT_ANTHROPIC_API_KEY";
const MISSING = `Set ${VAR} in .env.local`;

/**
 * The Bay Ballot API key: from the env file when it exists (local runs), else from
 * BAYBALLOT_ANTHROPIC_API_KEY in the environment (CI secrets). The shell's ANTHROPIC_API_KEY
 * belongs to another account and is never used. Never log the return value.
 */
export function resolveApiKey(envFilePath: string): string {
  let contents: string | null = null;
  try {
    contents = fs.readFileSync(envFilePath, "utf8");
  } catch {
    contents = null;
  }
  const key = (contents === null ? process.env[VAR] : parseEnv(contents)[VAR])?.trim();
  if (!key) throw new Error(MISSING);
  return key;
}

/**
 * A client pinned to the public API with only this key, so a shell's ANTHROPIC_BASE_URL or
 * ANTHROPIC_AUTH_TOKEN (e.g. a work proxy) can't redirect or re-authenticate the requests.
 */
export function makeClient(apiKey: string): Anthropic {
  return new Anthropic({ apiKey, authToken: null, baseURL: "https://api.anthropic.com" });
}
