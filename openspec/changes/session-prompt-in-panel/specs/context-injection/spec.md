## ADDED Requirements

### Requirement: Context object creation
The RLM agent SHALL create a Python `Context` object before the agentic loop begins. The `Context` class SHALL have at minimum a `prompt` attribute containing the user's initial task description. The object SHALL have a `__repr__` method that produces a human-readable representation of its contents.

#### Scenario: Context object has prompt attribute
- **WHEN** the RLM agent creates a context object with prompt "Write unit tests for the auth module"
- **THEN** `context.prompt` evaluates to `"Write unit tests for the auth module"` in the Pyodide environment

#### Scenario: Context object is printable
- **WHEN** the RLM agent's initial `print(context)` statement executes
- **THEN** the output includes the prompt text in a readable format (e.g. `Context(prompt='Write unit tests for the auth module')`)

### Requirement: Context injection into Pyodide
The `context` variable SHALL be set as a global in the Pyodide runtime before the first LLM turn begins. It MUST be available when the initial assistant message `print(context)` executes.

#### Scenario: Context available on first turn
- **WHEN** the agentic loop begins and the initial `print(context)` code block executes
- **THEN** the Pyodide runtime resolves `context` as a global variable and prints its representation without raising a `NameError`

#### Scenario: Context persists across turns
- **WHEN** the agent accesses `context.prompt` in turn N (where N > 1)
- **THEN** the same `context` object is available with the original prompt value

### Requirement: RLMConfig accepts max turns
The `RLMConfig` interface SHALL accept an optional `maxTurns` field. When provided, the agentic loop SHALL use this value as the maximum number of turns instead of the hardcoded value of 10. When omitted, the default of 10 SHALL be used.

#### Scenario: Custom max turns
- **WHEN** `createRLMSession` is called with `config.maxTurns` set to 15
- **THEN** the agentic loop runs for up to 15 turns before hitting the maximum turns limit

#### Scenario: Default max turns
- **WHEN** `createRLMSession` is called without `maxTurns` in the config
- **THEN** the agentic loop runs for up to 10 turns (the existing default behavior)

### Requirement: Initial message history uses context
The initial message history for the RLM session SHALL use the `context` variable as the primary way to pass the user's prompt to the LLM. The initial assistant message `print(context)` and the subsequent user message containing the execution output SHALL reflect the actual context object output rather than passing the raw prompt as execution output.

#### Scenario: Initial messages reference context
- **WHEN** a new RLM session starts with prompt "Analyze this codebase"
- **THEN** the initial message history includes an assistant message with `print(context)` and a user message containing the printed representation of the Context object (not the raw prompt string as execution output)
