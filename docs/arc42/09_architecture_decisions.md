# 9. Architecture Decisions

## ADR 1: Execution Sandboxing
- **Status:** Accepted
- **Decision:** Execute LLM agent operations inside Emscripten/Pyodide instead of invoking system Python commands. 
- **Reason:** Guarantee absolute isolation. System Python poses severe risks to untrusted logic generated dynamically by LLMs.

## ADR 2: Synchronous File I/O Workaround
- **Status:** Accepted
- **Decision:** Use `@vscode/sync-api-client` to bridge the gap between Emscripten synchronous file hooks and asynchronous VS Code extension APIs.
- **Reason:** Avoids attempting to refactor CPython's monolithic core file logic for Promises. Relying on `SharedArrayBuffer` and `Atomics` ensures performance and stability.

## ADR 3: Copy-on-Write (CoW) VFS
- **Status:** Accepted
- **Decision:** Build an Overlay / CoW FS inside WebAssembly.
- **Reason:** Necessary to let LLMs perform iterative, trial-and-error operations without prematurely modifying user’s source of truth.

## ADR 4: Session JSON format
- **Status:** Accepted
- **Decision:** Persist session memory to JSON workspace files rather than opaque extension mementos.
- **Reason:** Aligns inherently with workflows built on version control (git), collaboration, and direct plain-text modification.
