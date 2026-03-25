# Agent Evolution

The evolution of a coding agent, from a simple chatbot to a fully capable AI assistant -- in 8 incremental steps.

Each file is a **complete, standalone, runnable agent**. You can run any step independently to see that stage of evolution in action.

## Setup

```bash
cp .env.example .env
# Edit .env and add your Gemini API key
# Get one free at: https://aistudio.google.com/apikey
```

## Run any step

```bash
npx tsx agent-step-1.ts   # or any step 1-8
```

## The Evolution

| Step | File | Title | What it can do | Lines |
|------|------|-------|----------------|-------|
| 1 | `agent-step-1.ts` | **Basic Chat REPL** | Send a message, get a response. No memory. | ~45 |
| 2 | `agent-step-2.ts` | **Multi-Turn Conversation** | Remembers what you said earlier. | ~55 |
| 3 | `agent-step-3.ts` | **System Prompt** | Has a name (Jarvis), knows its role and directory. | ~70 |
| 4 | `agent-step-4.ts` | **Tool Definition & Detection** | Sees the model request a tool -- but can't execute it yet. | ~95 |
| 5 | `agent-step-5.ts` | **Tool Execution & Agentic Loop** | Executes list_files and loops until done. **This is where it becomes an agent.** | ~120 |
| 6 | `agent-step-6.ts` | **Read File Tool** | Can read any file. Introduces the dispatcher pattern. | ~145 |
| 7 | `agent-step-7.ts` | **Bash Tool** | Can run any shell command. git, grep, npm, anything. | ~175 |
| 8 | `agent-step-8.ts` | **Edit File Tool** | Can create and edit files. **Complete coding agent.** | ~215 |

## What to notice at each step

### Step 1 -> 2: Memory
Ask "my name is Alice", then "what's my name?". Step 1 forgets. Step 2 remembers.

### Step 2 -> 3: Identity
Ask "what's your name?". Step 2 doesn't know. Step 3 says "Jarvis".

### Step 3 -> 4: Tool awareness
Ask "what files are here?". Step 3 guesses. Step 4 tries to call a tool (but can't execute it).

### Step 4 -> 5: The agentic loop
Ask "what files are here?". Step 4 detects the tool call but stops. Step 5 executes it, sends the result back, and the model summarizes. **This is the fundamental architecture of every coding agent.**

### Step 5 -> 6: Multi-tool dispatch
The agent can now list AND read files. The pattern: declare tool, add a case to the dispatcher.

### Step 6 -> 7: Power
The agent can run any command. This is where it gets genuinely useful.

### Step 7 -> 8: Autonomy
The agent can modify your codebase. List, read, execute, edit -- the full toolkit.

## Architecture

Every step uses the same stack:

- **Language**: TypeScript (zero dependencies, Node.js stdlib only)
- **LLM**: Google Gemini 2.5 Flash (free tier, raw HTTP)
- **Runner**: `npx tsx` (no build step)
- **Total code**: ~210 lines for the complete agent

The core pattern (introduced in Step 5):

```
User input
  -> append to messages[]
  -> while (true):
       POST to Gemini API with messages[]
       if response is a tool call:
         execute the tool
         append model response + tool result to messages[]
         continue (call API again)
       if response is text:
         return it
         break
```

## Diffing steps

To see exactly what changed between any two steps:

```bash
diff agent-step-5.ts agent-step-6.ts
```

Every `[NEW]` comment in the code marks what was added in that step.

## Credits & Resources

This evolution follows the [Bloomery](https://github.com/mgratzer/bloomery) skill curriculum -- an interactive tutorial that guides you through building a coding agent from scratch.

- **Skill**: [mgratzer/bloomery](https://github.com/mgratzer/bloomery) -- install it and build your own agent step-by-step with AI guidance
- **Blog post**: [From Ore to Iron](https://mgratzer.com/posts/from-ore-to-iron/) -- the story behind building agents from raw HTTP calls