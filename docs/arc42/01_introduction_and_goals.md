# 1. Introduction and Goals

Spook AI is a VS Code extension that implements an Agent Command Environment for agentic coding. It integrates large language models (LLMs) into the developer workflow by utilizing Pyodide to run sandboxed Python code. 

## 1.1 Requirements Overview
The core feature of the system is Recursive Language Models (RLM). By providing a Python REPL to the LLM agent, it can use tools to interact with the environment recursively, writing and running its own code. 
Other main capabilities include:
- Managing calls to LLM API providers.
- Managing agentic coding sessions within the user's workspace.
- Organizing and exposing tools and MCP servers to the agent.
- Permitting non-destructive code edits and environment visibility via a customized Emscripten Virtual File System.

## 1.2 Quality Goals
- **Security & Integrity:** The agent code must run in an isolated environment where any filesystem mutations are contained in a volatile or sandbox layer. A user must approve changes before they are applied to the local workspace.
- **Usability:** Provide native VS code integration and clear session tracking to allow easy resumption, sharing, and version control of multi-turn interactions.
- **Performance:** Keep filesystem traversal and code execution fast despite WebAssembly constraints.

## 1.3 Stakeholders
- **Developers/Users:** Leverage the agent for rapid prototyping, debugging, and general software engineering.
- **System Administrators / Security Auditors:** Concerned with ensuring that the extension does not compromise the host system.
- **Extension Contributors:** Need clean APIs around the virtual filesystem, Pyodide initialization, and session state.
