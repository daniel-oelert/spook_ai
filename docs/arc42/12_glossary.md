# 12. Glossary

| Term | Definition |
| ---- | ---------- |
| **Pyodide** | A port of CPython to WebAssembly, providing an isolated Python environment inside browsers and Node platforms. |
| **RLM** | Recursive Language Model. An LLM agent pattern interacting iteratively with a REPL and calling itself globally recursively via code functions. |
| **CoW** | Copy-on-Write. A resource management strategy where data is shared in a read-only state until mutated, automatically splitting copies on demand. |
| **MEMFS** | Memory File System. An Emscripten backend that entirely stores directories and nodes inside local heap arrays. |
| **Whiteout** | A specific node or indicator object implemented inside the upper CoW overlay layer indicating an intentional deletion of a target file present in the lower layer. |
| **SharedArrayBuffer** | Low-level javascript array type capable of spanning parallel worker threads, utilized alongside `Atomics` to coordinate synchronous waits over asynchronous APIs. |
| **MCP** | Model Context Protocol. Protocols by which LLMs fetch and register additional environment context details programmatically. |
