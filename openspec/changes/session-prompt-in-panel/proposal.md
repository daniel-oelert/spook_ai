## Why

Session creation currently requires typing a prompt into a small text box in the session management sidebar before the session panel opens. This couples session creation with prompt entry, preventing the user from seeing the full session UI (model selection, agent mode, context) before committing to a task. Moving prompt entry into the session panel enables a richer pre-execution experience and aligns with the intended `context` variable design where the prompt should be part of the session context injected into the Pyodide runtime.

## What Changes

- **BREAKING** Remove the prompt text input and "Run RLM" button from the session management view. Replace with a single "New Session" button that opens an empty session panel.
- Add a welcome state to the session panel: a centered message (e.g. "What would you like to work on?") with the input textarea below it, shown when no conversation has started.
- Add pre-execution preferences UI in the session panel: model selection dropdown, agent mode selector, and max turns configuration. These are visible alongside the prompt input before the first submission.
- On first prompt submission, the selected preferences and prompt are used to initialize the RLM agent. The prompt is placed in `context.prompt`.
- Implement `context` variable injection into the Pyodide runtime. The context object is created with at minimum a `prompt` field containing the user's initial task description, and is available as a global variable in the Python sandbox.
- The existing `sendQuery` message from the session panel now carries the prompt and preferences to the extension backend, which handles provider initialization and RLM session creation.

## Capabilities

### New Capabilities
- `session-welcome-state`: Welcome UI shown when a session is opened without a prompt, including the centered message, prompt input, and pre-execution preference controls (model, agent mode, max turns).
- `context-injection`: Injection of the `context` variable into the Pyodide runtime, starting with `context.prompt` for the user's initial task description.

### Modified Capabilities
<!-- No existing specs to modify -->

## Impact

- **Webview (sessionManagementView.tsx)**: Remove prompt input and "Run RLM" button; add "New Session" button.
- **Webview (sessionPanel.tsx)**: Add welcome state, preference controls, and prompt submission flow that triggers session execution.
- **Extension (sessionManagementViewProvider.ts)**: Decouple session creation from prompt handling. The `newSession` command no longer carries a prompt. Session panel handles prompt + preferences and sends them to the backend when the user submits.
- **Extension (sessionManagementService.ts)**: May need updates to support starting a session without an initial prompt and later receiving execution parameters.
- **Agent (rlm.ts)**: Accept preferences (model, max turns, agent mode) from the session panel. Inject `context` object with `prompt` field into Pyodide globals before execution begins.
- **Shared types**: New message types for preferences and prompt submission from session panel to extension. New `Context` type definition.
- **API key handling**: The current `showInputBox` prompt for API key may need to be integrated into the preferences UI or kept as a separate step.
