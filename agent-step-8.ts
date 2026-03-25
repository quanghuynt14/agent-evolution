// @ts-nocheck
/**
 * ============================================
 * STEP 8: Edit File Tool (Complete Agent)
 * ============================================
 *
 * CONCEPT: The final tool that turns a "read-only assistant" into a
 * true coding agent. With edit_file, the agent can create new files
 * and modify existing ones using find-and-replace. This is the same
 * core toolkit that production coding agents use.
 *
 * WHAT'S NEW (vs Step 7):
 *   + edit_file tool declaration (path, old_string, new_string)
 *   + Create new files (when old_string is empty and file doesn't exist)
 *   + Find-and-replace in existing files
 *   + Validation: old_string must appear exactly once (no ambiguous edits)
 *
 * COMPLETE AGENT CAPABILITIES:
 *   - list_files: explore the filesystem
 *   - read_file:  read any file
 *   - run_bash:   execute any command
 *   - edit_file:  create and modify files
 *
 * RUN: npx tsx agent-step-8.ts
 * TEST: Ask "create a hello.txt file with 'Hello, World!'" or
 *       "add a comment to the top of agent-step-1.ts"
 *
 * This is the final form. ~210 lines. Zero dependencies. Raw HTTP.
 * You just built a coding agent from scratch.
 */

import * as readline from "node:readline";
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
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
            // [NEW] Edit file tool declaration
            {
              name: "edit_file",
              description:
                "Edit a file by replacing a specific string with new content. Can also create new files.",
              parameters: {
                type: "object",
                properties: {
                  path: {
                    type: "string",
                    description: "File path to edit or create",
                  },
                  old_string: {
                    type: "string",
                    description:
                      "String to find and replace (empty string to create new file or append)",
                  },
                  new_string: {
                    type: "string",
                    description: "Replacement string",
                  },
                },
                required: ["path", "old_string", "new_string"],
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
        try {
          result = execSync(args.command, {
            encoding: "utf-8",
            timeout: 30000,
          });
        } catch (err: any) {
          result = `Error executing command: ${err.message}. ${err.stdout ?? ""}. ${err.stderr ?? ""}`;
        }
      } else if (name === "edit_file") {
        // [NEW] Edit file implementation
        try {
          const { path, old_string, new_string } = args;

          if (old_string === "") {
            // Create new file or append to existing
            if (!existsSync(path)) {
              writeFileSync(path, new_string, "utf-8");
              result = `Created new file: ${path}`;
            } else {
              const existing = readFileSync(path, "utf-8");
              writeFileSync(path, existing + new_string, "utf-8");
              result = `Appended to file: ${path}`;
            }
          } else {
            // Find and replace
            if (!existsSync(path)) {
              result = `Error: file not found: ${path}`;
            } else {
              const content = readFileSync(path, "utf-8");
              const occurrences = content.split(old_string).length - 1;

              if (occurrences === 0) {
                result = `Error: old_string not found in ${path}`;
              } else if (occurrences > 1) {
                result = `Error: old_string found ${occurrences} times in ${path}. Must be unique.`;
              } else {
                const updated = content.replace(old_string, new_string);
                writeFileSync(path, updated, "utf-8");
                result = `Updated file: ${path}`;
              }
            }
          }
        } catch (err: any) {
          result = `Error editing file: ${err.message}`;
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
  console.log("Step 8: Edit File Tool (COMPLETE AGENT)");
  console.log("4 tools: list_files, read_file, run_bash, edit_file");
  console.log('Try: "create a hello.txt file with Hello World"\n');

  while (true) {
    const input = await prompt("> ");
    if (input.toLowerCase() === "exit") break;

    const response = await chat(input);
    console.log(response);
  }

  rl.close();
}

main().catch(console.error);
