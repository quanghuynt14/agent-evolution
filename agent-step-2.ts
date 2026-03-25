/**
 * ============================================
 * STEP 2: Multi-Turn Conversation
 * ============================================
 *
 * CONCEPT: In Step 1, each message was sent in isolation -- the model
 * had no memory. Now we accumulate all messages (user + model) in an
 * array and send the full history with every request. The model can
 * now reference earlier parts of the conversation.
 *
 * WHAT'S NEW (vs Step 1):
 *   + messages[] array that persists across the loop
 *   + User messages appended with role: "user"
 *   + Model responses appended with role: "model"
 *   + Full history sent with every API call
 *
 * RUN: npx tsx agent-step-2.ts
 * TEST: Say "my name is Alice", then ask "what's my name?"
 *       The model should remember. In Step 1, it couldn't.
 */

import * as readline from "node:readline";
import { readFileSync } from "node:fs";

// --- Load .env file ---
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

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const prompt = (q: string): Promise<string> =>
  new Promise((resolve) => rl.question(q, resolve));

// [NEW] Conversation history -- persists across the loop
const messages: any[] = [];

async function chat(userMessage: string): Promise<string> {
  // [NEW] Append user message to history
  messages.push({
    role: "user",
    parts: [{ text: userMessage }],
  });

  const body = {
    // [NEW] Send full conversation history, not just the latest message
    contents: messages,
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

  // [NEW] Append model response to history (Gemini returns {role: "model", parts: [...]})
  messages.push(data.candidates[0].content);

  return data.candidates[0].content.parts[0].text;
}

async function main() {
  console.log("Step 2: Multi-Turn Conversation (memory added)");
  console.log('Try: "my name is Alice" then "what\'s my name?"\n');

  while (true) {
    const input = await prompt("> ");
    if (input.toLowerCase() === "exit") break;

    const response = await chat(input);
    console.log(response);
  }

  rl.close();
}

main().catch(console.error);
