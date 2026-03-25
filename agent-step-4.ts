/**
 * ============================================
 * STEP 4: Tool Definition & Detection
 * ============================================
 *
 * CONCEPT: This is the first half of the big leap -- turning a chatbot
 * into an agent. We declare a tool (list_files) in the API request.
 * When the model wants to use it, it responds with a "function call"
 * instead of text. In this step, we detect it and log it -- but don't
 * execute it yet.
 *
 * WHAT'S NEW (vs Step 3):
 *   + tools[] array in the API request with list_files declaration
 *   + Detection: check if response contains a functionCall
 *   + Log the tool call (name + args) to the console
 *   + Return early when a tool call is detected (no execution yet)
 *
 * RUN: npx tsx agent-step-4.ts
 * TEST: Ask "what files are in the current directory?"
 *       You should see: Tool call: list_files({"directory": "."})
 *       But no actual file listing -- execution comes in Step 5.
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
    // [NEW] Tool declarations -- tell the model what tools are available
    tools: [
      {
        functionDeclarations: [
          {
            name: "list_files",
            description: "List files and directories at the given path",
            parameters: {
              type: "object",
              properties: {
                directory: {
                  type: "string",
                  description: "Directory path to list",
                },
              },
              required: ["directory"],
            },
          },
        ],
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

  messages.push(data.candidates[0].content);

  // [NEW] Check if the model wants to call a tool
  const functionCall = data.candidates[0].content.parts.find(
    (part: any) => part.functionCall
  );

  if (functionCall) {
    const { name, args } = functionCall.functionCall;
    console.log(`Tool call: ${name}(${JSON.stringify(args)})`);
    // Don't execute yet -- that's Step 5
    return "(Tool was requested but execution is not implemented yet)";
  }

  return data.candidates[0].content.parts[0].text;
}

async function main() {
  console.log("Step 4: Tool Definition & Detection (tools declared, not executed)");
  console.log('Try: "what files are in the current directory?"\n');

  while (true) {
    const input = await prompt("> ");
    if (input.toLowerCase() === "exit") break;

    const response = await chat(input);
    console.log(response);
  }

  rl.close();
}

main().catch(console.error);
