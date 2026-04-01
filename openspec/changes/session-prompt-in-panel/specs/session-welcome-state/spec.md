## ADDED Requirements

### Requirement: Session creation without prompt
The session management sidebar SHALL provide a "New Session" button that creates a session and opens the session panel without requiring a prompt. The previous prompt text input and "Run RLM" button SHALL be removed from the sidebar.

#### Scenario: User creates a new session
- **WHEN** user clicks the "New Session" button in the session management sidebar
- **THEN** a new session record is created and the session panel opens in a welcome state with no messages and no active agent

#### Scenario: Sidebar no longer has prompt input
- **WHEN** the session management sidebar view is rendered
- **THEN** there SHALL be no text input field for entering a prompt and no "Run RLM" button; only a "New Session" button and the "Refresh" button remain

### Requirement: Welcome state in session panel
When a session panel opens without an active conversation, it SHALL display a welcome state consisting of a centered message "What would you like to work on?" and the input textarea below it. The welcome state SHALL be replaced by the normal chat UI once the user submits their first prompt.

#### Scenario: Session panel shows welcome state on open
- **WHEN** a session panel opens for a newly created session with no messages
- **THEN** the panel displays a centered welcome message "What would you like to work on?" and the input textarea is enabled and focused

#### Scenario: Welcome state transitions to chat on first submission
- **WHEN** the user types a prompt and submits it in the welcome state
- **THEN** the welcome message disappears, the user's prompt appears as the first message in the chat, and the agent begins execution

### Requirement: Pre-execution preference controls
Before the first prompt is submitted, the session panel SHALL display preference controls for: model selection (dropdown), agent mode (selector), and max turns (numeric input). These controls SHALL be visible alongside the prompt input in the welcome state and SHALL disappear after the first submission.

#### Scenario: Preference controls visible in welcome state
- **WHEN** the session panel is in the welcome state
- **THEN** the user can see and interact with a model selection dropdown, an agent mode selector, and a max turns input, all with sensible defaults

#### Scenario: Preferences sent with first prompt
- **WHEN** the user submits their first prompt with custom preferences selected
- **THEN** the panel sends a `startExecution` message to the extension containing the prompt text, selected model, agent mode, and max turns value

#### Scenario: Preference controls hidden after submission
- **WHEN** the first prompt has been submitted and the agent is running
- **THEN** the preference controls are no longer visible; only the standard chat input remains

### Requirement: Start execution message handling
The extension SHALL listen for `startExecution` messages from session panel webviews. Upon receiving this message, the extension SHALL prompt for an API key (if not already configured), initialize the LLM provider with the selected model, and start the RLM session with the provided prompt and configuration.

#### Scenario: Extension receives startExecution
- **WHEN** the extension receives a `startExecution` message with prompt "Write unit tests", model "nemotron", agentMode "autonomous", and maxTurns 15
- **THEN** the extension prompts for an API key, creates an LLM provider with model "nemotron", and calls `createRLMSession` with the prompt and a config where maxTurns is 15

#### Scenario: User cancels API key input
- **WHEN** the extension prompts for an API key during `startExecution` and the user cancels the input
- **THEN** execution does not start, and the session panel remains in the welcome state (or shows an appropriate message)
