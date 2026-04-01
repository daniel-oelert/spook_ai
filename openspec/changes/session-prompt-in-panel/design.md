## Context

Currently, session creation is tightly coupled with prompt entry in `sessionManagementView.tsx`. The user types a prompt into a small text input, clicks "Run RLM", and the extension immediately creates a session, prompts for an API key via `vscode.window.showInputBox`, initializes the provider, and starts the RLM agentic loop. The session panel (`sessionPanel.tsx`) opens already mid-execution with the agent working.

The `context` variable is extensively documented in the RLM system prompt but never actually injected into the Pyodide runtime. The system prompt tells the LLM to inspect `context` (line 14 of rlm.ts), and the initial assistant message even does `print(context)`, but the variable doesn't exist — this causes an immediate error on the first turn.

Key files involved:
- `webview/sessionManagementView.tsx` — sidebar view with prompt input + "Run RLM" button
- `src/sessionManagementViewProvider.ts` — handles `newSession` command, creates provider, calls `createRLMSession`
- `webview/sessionPanel.tsx` — chat panel UI (currently has no role in session initialization)
- `src/sessionManagementService.ts` — creates session records, manages session panels
- `src/agent/rlm.ts` — RLM agent loop, Pyodide setup, LLM interaction
- `shared/types.ts` — message types for extension<->webview communication

## Goals / Non-Goals

**Goals:**
- Decouple session creation from prompt entry: "New Session" opens an empty session panel
- Add a welcome state to the session panel with prompt input and execution preferences (model, agent mode, max turns)
- Implement `context` variable injection into Pyodide with `context.prompt` containing the user's task
- Move the execution trigger from `sessionManagementViewProvider` to `sessionPanel` (user submits prompt in the panel)

**Non-Goals:**
- Full `context.store` implementation (key-value persistence across turns)
- `context.agents` or `context.tools` implementation
- API key management UI (keep the existing `showInputBox` approach for now)
- Saving/restoring session preferences
- Suggestion chips or templates in the welcome state

## Decisions

### 1. Session creation becomes prompt-free

**Decision:** The `newSession` command from the sidebar no longer carries a prompt. It creates the session record and opens an empty session panel. The session panel is responsible for collecting the prompt and preferences, then sending a `startExecution` message to the extension.

**Alternative considered:** Keep prompt in sidebar but add an "advanced" mode in the panel. Rejected because it splits the workflow unnecessarily and the sidebar text input is too small for meaningful prompts.

### 2. New message type: `startExecution`

**Decision:** Introduce a new webview-to-extension message `StartExecutionMessage` with fields: `prompt`, `model`, `agentMode`, `maxTurns`. The session panel sends this when the user submits their first prompt. The extension handler in `sessionManagementService` (or a new handler on the session panel's webview) receives it and starts the RLM session.

**Rationale:** This cleanly separates session creation (structural) from execution (behavioral). The session panel webview needs its own message handler since it's a separate `WebviewPanel`, not the sidebar view.

### 3. Preferences UI as pre-execution controls

**Decision:** Before the first prompt is submitted, the session panel shows a welcome state with:
- A centered message: "What would you like to work on?"
- The existing textarea input
- Above or beside the input: dropdowns/selectors for model, agent mode, and max turns
- These controls disappear after the first submission and the normal chat UI takes over

**Alternative considered:** Persistent settings panel or a modal dialog. Rejected — inline controls are simpler and don't break the flow.

### 4. Context injection as a Python object

**Decision:** Create a simple Python class `Context` with a `prompt` attribute, instantiate it, and set it as a Pyodide global before the agentic loop starts. The initial assistant message `print(context)` will then work correctly.

```python
class Context:
    def __init__(self, prompt):
        self.prompt = prompt
    def __repr__(self):
        return f"Context(prompt={self.prompt!r})"

context = Context(prompt="<user's prompt>")
```

**Rationale:** Using a class (vs. a dict) matches the system prompt's usage patterns (`context.prompt`, `context.agents["..."]`). Future fields can be added without changing the interface. The `__repr__` ensures `print(context)` gives useful output.

### 5. Message flow for session panel execution

**Decision:** The session panel's webview communicates with the extension via the `WebviewPanel.webview.onDidReceiveMessage` handler set up in `sessionManagementService.ts` when the panel is created. Currently this handler doesn't exist — the service only sends messages TO the panel. We need to add a message listener that handles `startExecution` and `sendQuery`.

**Flow:**
1. User clicks "New Session" in sidebar → `sessionManagementViewProvider` calls `sessionManagementService.newSession()` (no prompt)
2. Session panel opens with welcome state
3. User types prompt, sets preferences, clicks submit
4. Panel sends `{ command: 'startExecution', prompt, model, agentMode, maxTurns }`
5. Extension receives message, prompts for API key, creates provider with selected model, calls `createRLMSession` with prompt and config
6. RLM agent injects `context` with prompt, starts the loop
7. Subsequent messages from the panel use `sendQuery` (for future multi-turn support)

### 6. RLMConfig extension

**Decision:** Add optional fields to `RLMConfig`: `maxTurns?: number` and `agentMode?: string`. The hardcoded `turnCount < 10` becomes `turnCount < (config.maxTurns || 10)`. Agent mode is stored but not acted on yet (placeholder for future behavior).

## Risks / Trade-offs

- **[API key prompt still uses showInputBox]** → This is a known UX gap. Mitigation: keep it for now; a future change can integrate it into the preferences panel or add key management.
- **[Session panel needs its own message handler]** → The `sessionManagementService` currently only sends messages to session panels, never listens. Adding a listener per panel increases complexity slightly. Mitigation: the listener is straightforward and follows the same pattern as the sidebar view.
- **[Context class is minimal]** → Only `prompt` is implemented. The system prompt references `context.agents`, `context.tools`, etc. which will raise `AttributeError` if accessed. Mitigation: the LLM will see the `print(context)` output showing only `prompt`, which is better than the current crash. Future changes add more fields.
- **[Model selection requires knowing available models]** → We need a list of models for the dropdown. Mitigation: start with a hardcoded list matching the current provider setup; make it configurable later.
