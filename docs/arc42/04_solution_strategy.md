# 4. Solution Strategy

The Spook AI system employs significant advanced strategies to manage its agentic interactions securely:

## 4.1 Recursive Language Models (RLM)
Instead of rigidly generating code logic to output directly to users, the application forces the LLM to output runnable Python code inside a REPL. 
The LLM evaluates intermediate steps, probes APIs, examines files, and conditionally queries itself or the user recursively using specialized tools embedded into its Python runtime (e.g., `context.tools.subagent()` or `context.tools.ask()`). The loop ends when the final code output signifies task completion.

## 4.2 WebAssembly (Pyodide) Sandboxing
Python execution happens strictly within a Pyodide-based WebWorker to limit exposure to malicious or flawed code produced by the LLM. 

## 4.3 Copy-on-Write (CoW) Virtual Filesystem
To provide the python REPL with visibility of the local workspace without allowing it to mutate files blindly:
- A custom FS backend intercepts all Emscripten FS system calls.
- The **lower layer** uses `@vscode/sync-api-client` to synchronously read files directly from the actual VS Code workspace.
- The **upper layer** functions as a custom in-memory node tree. Any mutation (create, write, delete) triggers a copy-up mechanism into a `CoWNode` object or drops a "whiteout" marker (a `Set` of deleted names), isolating changes until they are formally reviewed and applied by the user.

## 4.4 Session Persistence
Sessions are purely file-backed representation stored natively as JSON blobs in `.spook/sessions` of the workspace. This inherently solves version control, sharing, branching, and debugging of LLM prompts.
