/**
 * ============================================
 * STEP 3: System Prompt
 * ============================================
 *
 * CONCEPT: Give the agent an identity. Without a system prompt, the
 * model is a generic chatbot -- it doesn't know its name, its purpose,
 * or how to behave. The system prompt turns it into a "coding assistant"
 * that knows where it's running and what it should do.
 *
 * WHAT'S NEW (vs Step 2):
 *   + systemInstruction field in the API request
 *   + Agent has a name ("Jarvis"), a role, and instructions
 *   + Knows its working directory (process.cwd())
 *
 * RUN: npx tsx agent-step-3.ts
 * TEST: Ask "what's your name?" -- it should say "Jarvis".
 *       Ask "where are you running?" -- it should know the directory.
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

const messages: any[] = [];

async function chat(userMessage: string): Promise<string> {
  messages.push({
    role: "user",
    parts: [{ text: userMessage }],
  });

  const body = {
    // [NEW] System prompt -- gives the agent identity and instructions
    systemInstruction: {
      parts: [
        {
          text: `You are Jarvis, a coding assistant. You help users with programming tasks.

You have access to tools that let you interact with the filesystem and run commands.
Use tools proactively — for example, list files to understand a project before asking
the user for specific paths.

Working directory: ${process.cwd()}`,
        },
      ],
    },
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

  messages.push(data.candidates[0].content);

  return data.candidates[0].content.parts[0].text;
}

async function main() {
  console.log("Step 3: System Prompt (identity added)");
  console.log('Try: "what\'s your name?" or "where are you running?"\n');

  while (true) {
    const input = await prompt("> ");
    if (input.toLowerCase() === "exit") break;

    const response = await chat(input);
    console.log(response);
  }

  rl.close();
}

main().catch(console.error);
