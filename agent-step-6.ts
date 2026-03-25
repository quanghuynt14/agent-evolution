// @ts-nocheck
/**
 * ============================================
 * STEP 6: Read File Tool
 * ============================================
 *
 * CONCEPT: One tool is a proof of concept. Two tools require a
 * DISPATCHER -- routing logic that calls the right function based
 * on the tool name. This is the pattern for every tool you add.
 *
 * With list_files + read_file, the agent can now explore a codebase:
 * list what's there, then read any file it's curious about.
 *
 * WHAT'S NEW (vs Step 5):
 *   + read_file tool declaration
 *   + Tool dispatcher: if/else routing by function name
 *   + Error handling: file not found returns error string, doesn't crash
 *
 * RUN: npx tsx agent-step-6.ts
 * TEST: Ask "read the .env.example file" or "what's in agent-step-1.ts?"
 *       The agent will list files, then read the one you asked about.
 */

import * as readline from "node:readline";
import { readFileSync, readdirSync } from "node:fs";

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

  while (true) {
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
            // [NEW] Second tool declaration
            {
              name: "read_file",
              description: "Read the contents of a file at the given path",
              parameters: {
                type: "object",
                properties: {
                  path: {
                    type: "string",
                    description: "File path to read",
                  },
                },
                required: ["path"],
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

    const functionCall = data.candidates[0].content.parts.find(
      (part: any) => part.functionCall
    );

    if (functionCall) {
      const { name, args } = functionCall.functionCall;
      console.log(`Tool call: ${name}(${JSON.stringify(args)})`);

      // [NEW] Tool dispatcher -- route by function name
      let result: string;

      if (name === "list_files") {
        try {
          const files = readdirSync(args.directory);
          result = files.join("\n");
        } catch (err: any) {
          result = `Error listing directory: ${err.message}`;
        }
      } else if (name === "read_file") {
        // [NEW] Read file implementation with error handling
        try {
          result = readFileSync(args.path, "utf-8");
        } catch (err: any) {
          result = `Error reading file: ${err.message}`;
        }
      } else {
        result = `Unknown tool: ${name}`;
      }

      messages.push({
        role: "function",
        parts: [
          {
            functionResponse: {
              name: name,
              response: { name: name, content: result },
            },
          },
        ],
      });
    } else {
      return data.candidates[0].content.parts[0].text;
    }
  }
}

async function main() {
  console.log("Step 6: Read File Tool (can now explore code)");
  console.log('Try: "what\'s in agent-step-1.ts?" or "read the .env.example file"\n');

  while (true) {
    const input = await prompt("> ");
    if (input.toLowerCase() === "exit") break;

    const response = await chat(input);
    console.log(response);
  }

  rl.close();
}

main().catch(console.error);
