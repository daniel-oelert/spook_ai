# 2. Architecture Constraints

## 2.1 Technical Constraints
- **VS Code Extension Environment:** The application must operate within the resource limits and asynchronous architecture established by the VS Code extension host.
- **WebAssembly (WASM) Sandbox:** Pyodide executes in a WASM sandbox. This inherently limits capabilities (e.g., no native C-extensions without pre-compilation, networking relies on fetch/WebSockets rather than raw sockets).
- **Memory Limitation:** WebAssembly's 32-bit execution environment restricts Pyodide to approximately 2GB of memory. High data footprint operations (e.g., processing huge CSV files directly in memory) could exhaust the memory.

## 2.2 Integration Constraints
- **Synchronous versus Asynchronous APIs:** The Emscripten Virtual File System (used by Pyodide) requires a synchronous API. In contrast, VS Code’s Workspace Filesystem API operates asynchronously. This necessitates a synchronous bridge that can induce inter-process communication overhead.
- **Read-Only / Copy-On-Write Necessity:** To prevent unintentional damage to user files, real files must be treated as a lower read-only layer until explicitly overwritten.
- **Require confirmation for every potentially hazardous tool call:** The user must be able to confirm or deny every potentially hazardous tool call before it is executed.

## 2.3 Organizational Constraints
- Standard packaging and distribution processes as a VS Code Extension (`.vsix`).
- Project structure has documentation organized into `docs/arc42`, `docs/specs`, and `docs/research`.
