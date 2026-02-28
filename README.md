# Spook AI

Spook AI is an advanced "Agent Command Environment" for agentic coding, built as a VS Code extension. It provides a robust, sandboxed execution environment (using Pyodide and WebAssembly) allowing a Large Language Model (LLM) to recursively run dynamically generated Python scripts against your workspace seamlessly and securely.

## Features

- **RLM (Recursive Language Models):** The extension provides a sandboxed Python REPL through WASM to the LLM agent, giving it the ability to write and execute its own code. The agent can use built-in tools like `context.tools.subagent(prompt, agent)` for recursive LLM calls and `context.tools.ask(prompt)` to interact securely with the human-in-the-loop.
- **CoW (Copy-on-Write) Overlay Filesystem:** The workspace is safely abstracted using an Emscripten Virtual File System. This enables the sandbox to read the codebase without ever mutating it until the user formally reviews and approves the changes.
- **Agentic Session Management:** Create, fork, edit, and delete coding sessions. Sessions are robustly stored locally in `.spook/sessions` as JSON configurations, supporting version control and easy sharing.
- **Dynamic Toolsets:** Toolsets (collections of tools) can be specifically scoped and loaded into the LLM context to prevent context pollution and improve performance. Custom toolsets can be defined in `.spook/toolsets` as JSON configurations.
- **Flexible Providers:** Use almost any LLM API provider of your choice.

## Documentation Overview

The complete software architecture documentation is structured according to the [arc42](https://arc42.org/) template format and detailed specifications can be found under the `docs/` folder:

- [System Scope and Introduction (arc42)](./docs/arc42/overview.md)
- [Features Specification](./docs/specs/01_features.md)
- [Recursive Language Models Specification](./docs/specs/01_01_agentic_coding.md)
- [Session Data Structures](./docs/specs/01_01_01_sessions.md)
- [Toolsets Specification](./docs/specs/01_01_02_toolsets.md)

## Security and Integrity

The extension runs agent execution scripts explicitly via a volatile overlay mechanism. Because of sandbox constraints, your host workstation remains secure and performance-optimal since no rogue scripts can execute permanent direct writes to your workspace configuration without explicit user review.

## Architecture

Spook AI runs directly as a standard VS Code extension. The architectural deployment comprises:
- **Extension Host:** Node.js process managing UI APIs and file actions.
- **Web Worker:** Dedicated background thread for Pyodide sandbox execution avoiding UI locks.
- **WebViews:** Used to independently render interactive chat interactions and session interfaces.
