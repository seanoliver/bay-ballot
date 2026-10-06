import fs from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { parseEnv } from "node:util";

const VAR = "BAYBALLOT_ANTHROPIC_API_KEY";
const MISSING = `Set ${VAR} in .env.local`;

/** Never falls back to ANTHROPIC_API_KEY: the shell's key bills another account. Never log the result. */
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

/** Explicit baseURL and null authToken, so a shell's ANTHROPIC_BASE_URL or ANTHROPIC_AUTH_TOKEN can't apply. */
export function makeClient(apiKey: string): Anthropic {
  return new Anthropic({ apiKey, authToken: null, baseURL: "https://api.anthropic.com" });
}
