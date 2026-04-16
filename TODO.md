- Multi Folder workflow support
    - run spook in all subfolders

- start spook in folder causes lock file to be created in .spook
    - lock file should contain process id

- CoW for files larger than RAM

- CoW breakout protection
    - symlinks?

- Research session key-value store
    - JSON
    - Pickle

Phase 1: Environment & Context Assembly
Task 1.1: Dynamically Inject Workspace Context

Objective: Modify runRudimentaryRLMSession in src/agent/rlm.ts to include dynamically gathered context in the SYSTEM_PROMPT.
Implementation: Query vscode.workspace properties (like the workspace path, workspace name, list of currently active text editors, etc.) and inject a textual representation of this state into the initial LLM prompt.
Task 1.2: Implement File Hiding/Filtering in CoW Filesystem

Objective: Prevent the agent from getting lost in large directories or reading sensitive files.
Implementation: In 
src/agent/rlm.ts
, where 
createCoWBackend
 is called, replace the empty array [] with a sensible default array of regex patterns (e.g., [/\/\.git\//, /\/node_modules\//, /\/\.env$/]). Verify these filters are passed to 
fs.ts
.
Task 1.3: Enable Pyodide Package Installation via Micropip

Objective: Ensure the Python environment can install third-party libraries if requested by the LLM.
Implementation: Inject standard python code ahead of the LLM's code block that uses Pyodide's micropip module (e.g., parsing import statements and running await micropip.install('package_name')) before executing pyodide.runPythonAsync(pythonCode).
Phase 2: Agent Tooling and JS Bridge (Subagents)
Task 2.1: Register the spook_tools JS Module in Pyodide

Objective: Provide a global namespace inside Python for the agent to call VS Code extension functions.
Implementation: In 
src/agent/rlm.ts
, immediately after loadPyodide(), use pyodide.registerJsModule("spook_tools", { ... }) and register a basic dummy function. Add this module to the Python execution's global scope.
Task 2.2: Implement the done() Tool

Objective: Give the agent an explicit way to signal the completion of its task rather than relying on the absence of a Python block.
Implementation: In the injected spook_tools module, add a done() function. Update the loop condition in 
runRudimentaryRLMSession
 to break out when this tool is invoked by a boolean flag isAgentFinished toggled by the JS callback.
Task 2.3: Implement the ask_user() Tool

Objective: Allow the agent to pause execution and prompt the user for clarifying information.
Implementation: Add an ask_user(question: str) -> str function to spook_tools. When called, use vscode.window.showInputBox to pause execution, get the user's string answer, and return it synchronously to the Python REPL.
Task 2.4: Implement the subagent(task) Tool

Objective: Enable recursive agent execution as documented in the runtime view.
Implementation: Add a subagent(task: str) -> str function to spook_tools that recursively runs 
runRudimentaryRLMSession
 (or a similar detached variant) and returns its summarized result. Carefully manage the turn counter or token limits for nested instances.
Phase 3: Committing CoW Filesystem Changes
Task 3.1: Retrieve and Classify Dirty Nodes Post-Execution

Objective: Extract the list of modifications the agent made to the CoW filesystem at the end of the session.
Implementation: At the end of 
runRudimentaryRLMSession
, obtain the root node (cowFS.root) and call 
getDirtyNodes(rootNode)
 from 
fs.ts
. Print or log the arrays of added, modified, and deleted paths to the OutputChannel.
Task 3.2: Create a Workspace "Commit" Function

Objective: Physically save the modified and added files from the CoW filesystem to the actual VS Code workspace.
Implementation: Write a function commitChangesToWorkspace(dirtyNodes, cowFS) that iterates through the dirty nodes, retrieves the Uint8Array content from the 
CoWNode
, and uses vscode.workspace.fs.writeFile() to safely write back to disk. Use vscode.workspace.fs.delete() for deleted items.
Task 3.3: Implement the User Approval UI (Diff View)

Objective: Ensure no changes are saved without explicit user permission.
Implementation: Before calling the commit function from Task 3.2, iterate through the dirty nodes and launch vscode.commands.executeCommand('vscode.diff', uri1, uri2, title) for each file. Use vscode.window.showInformationMessage("Accept Agent Changes?", "Approve", "Reject") to capture the final user decision.
Phase 4: Error Handling & Context Window Management
Task 4.1: Wrap Python Execution with a Timeout ✅ (implemented in feat/python-execution-timeout)

Objective: Prevent infinite python loops from hanging the extension.
Implementation: Wrap await pyodide.runPythonAsync(pythonCode) in
src/agent/rlm.ts
 with Promise.race() against a configurable timeout (e.g., 30 seconds). Upon timeout, forcefully terminate/re-initialize the Pyodide WebWorker to clear the freeze, and send a timeout error to the LLM.
Task 4.2: Implement Sliding Context Window limits

Objective: Stop the session from crashing with API Token Limits on long code generation sessions.
Implementation: After appending to the messages: LLMMessage[] array in 
rlm.ts
, tally the approximate token count (e.g. 1 word ≈ 1.3 tokens). If the limit is approached, remove or summarize the oldest intermediate assistant/user execution output pairs. Ensure the SYSTEM_PROMPT is never truncated.
Phase 5: Session webview Integration
Task 5.1: Pipe RLM Output to the Session Store

Objective: Ensure the chat log and python execution results are visible in the web UI.
Implementation: Refactor 
runRudimentaryRLMSession
 to accept the sessionId and the SessionStore instance. Instead of just appending to vscode.OutputChannel, append chunks and execution results by calling await sessionStore.updateSession(...) to synchronize state with the React Webview.
Task 5.2: Dispatch Webview Messages from the REPL

Objective: When the LLM outputs text (non-python blocks) or execution blocks, post real-time updates directly to the webview UI using Webview event messages (e.g., panel.webview.postMessage({ command: "append_output", data: ...})).