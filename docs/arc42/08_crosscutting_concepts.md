# 8. Cross-cutting Concepts

## 8.1 Filesystem Hiding and Visibility Filtering
Spook AI masks certain files to ease LLM token load and restrict security scope.
- `lookup()` and `readdir()` in the CoW filter any absolute path against exclusion lists.
- Path traversal outside workspace boundaries is stringently blocked via absolute/relative path boundary checks.

## 8.2 Safe Edits (Review and Diff)
Since all changes live inside Pyodide's custom CoW hierarchy (as in-memory `CoWNode` objects), developers invoke standard VS Code diff panels (comparing `vscode.workspace.fs` read files versus the custom in-memory CoW cached files) before formally saving changes. 
Whiteouts signify file deletions by the LLM, translating to UI visual indicators like a "Deleted" status tag.

## 8.3 State Persistence (JSON Sessions)
Sessions exist at `.spook/sessions/`. 
The format enforces strict standards:
- Human readable JSON allows users to drop-in edits via normal code diff.
- Simplifies portability: A user commits `.spook/sessions/` to an internal registry if they found an effective RLM workflow on a task.
