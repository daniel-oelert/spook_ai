# Spook AI - Software Architecture Documentation

This directory contains the software architecture documentation for the **Spook AI** VS Code extension, structured according to the [arc42](https://arc42.org/) template format.

Spook AI is an advanced "Agent Command Environment" extending VS Code. It provides a robust, sandboxed execution environment (using Pyodide and WebAssembly) allowing an LLM to recursively run dynamically generated Python scripts against your workspace seamlessly and securely.

## Table of Contents

1. [Introduction and Goals](./01_introduction_and_goals.md)
2. [Architecture Constraints](./02_architecture_constraints.md)
3. [System Scope and Context](./03_system_scope_and_context.md)
4. [Solution Strategy](./04_solution_strategy.md)
5. [Building Block View](./05_building_block_view.md)
6. [Runtime View](./06_runtime_view.md)
7. [Deployment View](./07_deployment_view.md)
8. [Cross-cutting Concepts](./08_crosscutting_concepts.md)
9. [Architecture Decisions](./09_architecture_decisions.md)
10. [Quality Requirements](./10_quality_requirements.md)
11. [Risks and Technical Debts](./11_risks_and_technical_debts.md)
12. [Glossary](./12_glossary.md)

---
### Key Innovative Concepts
- **[RLM (Recursive Language Models)](../specs/rlm.md):** The LLM evaluates tools, APIs, and file states autonomously via recursive REPL queries.
- **[CoW Overlay Filesystem](../research/CoW_FS.md):** Complete abstraction of local project workspace files enabling the sandbox to view the codebase without ever destructively mutating it until the user formally reviews and approves the deltas.
