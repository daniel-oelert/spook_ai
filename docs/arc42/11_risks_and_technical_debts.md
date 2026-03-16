# 11. Risks and Technical Debts

## 11.1 Technical Risks
| Risk Area | Description | Mitigation Strategy |
| --------- | ----------- | ------------------- |
| **WASM Memory Constraints** | WebAssembly enforces a restrictive approx 2GB memory boundary. Extensive codebase loads inside Pyodide could cause catastrophic out-of-memory (OOM) failures. | Advise/Enforce strict bounds on operations directly touching heavy files. Limit size loaded into custom CoWNode memory buffers. |
| **Thread Hop Latency** | Interacting with the VS code asynchronous file descriptors from Pyodide's synchronous loop relies on shared buffer waits. This incurs small latencies. | Cache deeply at lookup hooks, caching `stat` calls recursively if feasible. |
| **WasmFS Migration** | Emscripten's impending timeline toward shifting legacy JavaScript File System hooks into WasmFS (C++) will require significant rewrites of `fs.ts`. | Maintain highly abstracted Node and Stream OP interfaces that can easily adapt to C++ implementations conceptually in the future. |
