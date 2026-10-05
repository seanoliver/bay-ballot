import fs from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { parseEnv } from "node:util";

const VAR = "BAYBALLOT_ANTHROPIC_API_KEY";
const MISSING = `Set ${VAR} in .env.local`;

/**
 * Read the Bay Ballot API key from an env file. The shell's ANTHROPIC_API_KEY belongs to
 * another account, so this never falls back to process.env. Never log the return value.
 */
export function resolveApiKey(envFilePath: string): string {
  let contents: string;
  try {
    contents = fs.readFileSync(envFilePath, "utf8");
  } catch {
    throw new Error(MISSING);
  }
  const key = parseEnv(contents)[VAR]?.trim();
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
