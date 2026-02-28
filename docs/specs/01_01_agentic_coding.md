# RLM

The principle of RLM is to provide a Python REPL to the LLM and let it use tools to interact with the environemnt. One of these tools is the ability to call the LLM again, which allows for recursive language model calls. Another tool, that is included, is the ability to ask the user for input.

The system prompt has to include that, while thinking is allowed, the LLM should not output anything besides runnable Python code. This means that the LLM should not output any text outside of the Python code blocks. 

## Tools

The LLM always has access to the following tools:

- `print()`: Prints the given arguments to the console, which the LLM can then read. The stdout/stderr is captured after the Python code that the LLM has written is executed and returned as the next message.
- `context.tools.subagent(prompt: str, agent: str)`: Calls the LLM with the given prompt. This is the recursive part of RLM.
- `context.tools.ask(prompt: str)`: Asks the user for input. This is the human-in-the-loop part of RLM.

Other tools can be added by the extension. 

