/**
 * ============================================
 * STEP 1: Basic Chat REPL
 * ============================================
 *
 * CONCEPT: The simplest possible agent -- a loop that reads user input,
 * sends it to an LLM via HTTP, and prints the response. No memory,
 * no identity, no tools. Just a raw chat interface.
 *
 * WHAT'S HERE:
 *   - Load API key from .env file (no dependencies)
 *   - A readline loop for user input
 *   - A single HTTP POST to Gemini API
 *   - Print the response text
 *
 * WHAT'S MISSING:
 *   - No conversation memory (each message is independent)
 *   - No system prompt (the model has no identity)
 *   - No tools (can't interact with the filesystem)
 *
 * RUN: npx tsx agent-step-1.ts
 * TEST: Type any message and get a response. Try asking a follow-up
 *       question -- notice the model has no memory of what you said before.
 */

import * as readline from "node:readline";
import { readFileSync } from "node:fs";

// --- Load .env file (no external dependencies) ---
const env = readFileSync(".env", "utf-8");
for (const line of env.split("\n")) {
  const [key, ...vals] = line.split("=");
  if (key?.trim() && vals.length) {
    const v = vals.join("=").trim();
    if (v && !v.startsWith("#")) process.env[key.trim()] = v;
  }
}

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error("Missing GEMINI_API_KEY in .env file");
  process.exit(1);
}

// --- Readline interface ---
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const prompt = (q: string): Promise<string> =>
  new Promise((resolve) => rl.question(q, resolve));

// --- Chat function: send a single message, get a response ---
async function chat(userMessage: string): Promise<string> {
  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: userMessage }],
      },
    ],
    generationConfig: {
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  const data = await res.json();

  if (!data.candidates?.[0]?.content) {
    console.error("Unexpected API response:", JSON.stringify(data, null, 2));
    return "Error: unexpected response from API";
  }

  return data.candidates[0].content.parts[0].text;
}

// --- Main loop ---
async function main() {
  console.log("Step 1: Basic Chat REPL (no memory, no tools)");
  console.log('Type a message and press Enter. Type "exit" to quit.\n');

  while (true) {
    const input = await prompt("> ");
    if (input.toLowerCase() === "exit") break;

    const response = await chat(input);
    console.log(response);
  }

  rl.close();
}

main().catch(console.error);
