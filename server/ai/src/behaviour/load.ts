import fs from "fs";
import path from "path";

const BEHAVIOUR_PATH = path.join(__dirname, "..", "..", "behaviour", "core-framework.md");

let cached: string | null = null;

export function loadBehaviourPrompt(): string {
  if (cached) return cached;
  cached = fs.readFileSync(BEHAVIOUR_PATH, "utf8");
  return cached;
}

export function buildSystemPrompt(knowledgeIndex: string): string {
  return `${loadBehaviourPrompt()}

=========================================================
COMPANY CONTEXT (from Knowledge Layer — facts only)
=========================================================

You represent Onairo Solutions. Use the following index and tools for facts.

${knowledgeIndex}
`;
}
