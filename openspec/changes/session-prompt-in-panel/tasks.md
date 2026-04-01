## 1. Shared Types & Messages

- [ ] 1.1 Add `StartExecutionMessage` type to `shared/types.ts` with fields: `command: 'startExecution'`, `prompt: string`, `model: string`, `agentMode: string`, `maxTurns: number`, and `sessionId: string`
- [ ] 1.2 Add `StartExecutionMessage` to the `WebviewToExtensionMessage` union type and create a type guard `isStartExecutionMessage`
- [ ] 1.3 Add optional `maxTurns` and `agentMode` fields to `RLMConfig` interface in `src/agent/rlm.ts`

## 2. Context Injection (Pyodide)

- [ ] 2.1 In `src/agent/rlm.ts`, add Python code to define the `Context` class with `prompt` attribute and `__repr__` method, executed via `pyodide.runPythonAsync` before the agentic loop
- [ ] 2.2 Instantiate the `Context` object with the user's prompt and set it as a Pyodide global (`context = Context(prompt=...)`)
- [ ] 2.3 Update the initial message history so the user message after `print(context)` contains the context repr output instead of the raw prompt string
- [ ] 2.4 Replace the hardcoded `turnCount < 10` with `turnCount < (config.maxTurns || 10)`

## 3. Session Management View (Sidebar)

- [ ] 3.1 In `webview/sessionManagementView.tsx`, remove the prompt text input and "Run RLM" button
- [ ] 3.2 Add a "New Session" button that sends `{ command: 'newSession' }` without a prompt text
- [ ] 3.3 Update `sessionManagementViewProvider.ts` to handle `newSession` without a prompt — create session and open panel only, no API key prompt or RLM execution

## 4. Session Panel Welcome State

- [ ] 4.1 In `webview/sessionPanel.tsx`, add a `hasStarted` signal (initially false) to track whether the session has been initialized with a prompt
- [ ] 4.2 Create a welcome state component with centered "What would you like to work on?" message
- [ ] 4.3 Add preference controls to the welcome state: model selection dropdown (hardcoded list), agent mode selector, and max turns numeric input with defaults
- [ ] 4.4 Conditionally render the welcome state (when `hasStarted` is false) or the normal chat messages area (when true)

## 5. Session Panel Execution Flow

- [ ] 5.1 Update `handleSendMessage` in `sessionPanel.tsx` to detect first submission: set `hasStarted` to true, send `startExecution` message (with prompt, model, agentMode, maxTurns, sessionId) instead of `sendQuery`
- [ ] 5.2 Add CSS styles for the welcome state layout (centered content, preference controls positioning)

## 6. Extension Message Handling

- [ ] 6.1 In `sessionManagementService.ts`, add `onDidReceiveMessage` listener to session panel webviews when they are created
- [ ] 6.2 Handle `startExecution` messages in the listener: prompt for API key, create provider with selected model, call `createRLMSession` with prompt and config (including maxTurns and agentMode)
- [ ] 6.3 Handle the case where the user cancels the API key input — send a message back to the panel or leave it in welcome state
