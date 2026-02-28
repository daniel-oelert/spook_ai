# 10. Quality Requirements

## 10.1 Quality Tree
- **Reliability:** 
  - *Sandboxing:* Failed or malicious loops by the LLM shouldn't crash the IDE. Uses strict timeouts and memory boundaries.
- **Security:**
  - *Data Leakage Check:* Files flagged in exclusion lists (`.env`, `secrets.json`) must physically never touch memory exposed to Pyodide APIs.
- **Maintainability:** 
  - Emscripten FS modifications inside `src/fs.ts` must be modular to eventually migrate smoothly towards WasmFS once Emscripten matures it further.
- **Performance:**
  - *Caching:* Mitigate the inter-thread Sync API boundary latency when possible by caching metadata lookup queries intelligently if states haven't mutated.
