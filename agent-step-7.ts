/**
 * ============================================
 * STEP 7: Bash Tool
 * ============================================
 *
 * CONCEPT: A bash tool is what makes an agent truly powerful -- it can
 * run any command the user could run. git status, npm test, grep -rn,
 * curl, python scripts... anything. This is also the most dangerous
 * tool, so we add a timeout to prevent hanging.
 *
 * WHAT'S NEW (vs Step 6):
 *   + run_bash tool declaration
 *   + execSync implementation with 30-second timeout
 *   + Error handling: non-zero exit codes return stderr, don't crash
 *   + The agent can now run arbitrary shell commands
 *
 * RUN: npx tsx agent-step-7.ts
 * TEST: Ask "run git status" or "how many lines of code are in this directory?"
 *       The agent can now run commands and report results.
 */

import * as readline from "node:readline";
import { readFileSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";

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
            // [NEW] Bash tool declaration
            {
              name: "run_bash",
              description: "Execute a bash command and return its output",
              parameters: {
                type: "object",
                properties: {
                  command: {
                    type: "string",
                    description: "Bash command to execute",
                  },
                },
                required: ["command"],
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

      let result: string;

      if (name === "list_files") {
        try {
          const files = readdirSync(args.directory);
          result = files.join("\n");
        } catch (err: any) {
          result = `Error listing directory: ${err.message}`;
        }
      } else if (name === "read_file") {
        try {
          result = readFileSync(args.path, "utf-8");
        } catch (err: any) {
          result = `Error reading file: ${err.message}`;
        }
      } else if (name === "run_bash") {
        // [NEW] Execute bash command with timeout and error handling
        try {
          result = execSync(args.command, {
            encoding: "utf-8",
            timeout: 30000,
          });
        } catch (err: any) {
          result = `Error executing command: ${err.message}. ${err.stdout ?? ""}. ${err.stderr ?? ""}`;
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
  console.log("Step 7: Bash Tool (can now run any command)");
  console.log('Try: "run git status" or "count lines of code in this directory"\n');

  while (true) {
    const input = await prompt("> ");
    if (input.toLowerCase() === "exit") break;

    const response = await chat(input);
    console.log(response);
  }

  rl.close();
}

main().catch(console.error);
