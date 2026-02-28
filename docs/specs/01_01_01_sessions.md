# Sessions

A session is a basically a history of REPL calls. The prompt is sent to the LLM in the form of a variable in the global scope of the Python interpreter. The LLM can then use the tools to interact with the environment. The user can create, fork, edit and delete sessions.

Sessions are stored in the workspace in the `.spook/sessions` directory. Sessions are entirely contained within a single JSON file. This allows for easy sharing and version control of sessions if desired. A session file looks like this:

**Caveat:** Sessions are by design not stateless. They can not be saved and restored in a way that the LLM can resume the session exactly where it left off. The LLM can only resume the session from the last message in the session. This is a limitation of the current implementation. To mitigate this, the `context` object inside a session contains a member `context.store` which is a simple key-value store that can be used to store and retrieve information that should persist across messages. This should also be persisted in the session file.

Example: `.spook/sessions/2022_01_01_18_31_55_my_session.json`
```json
{
    "name": "My Session", // can be changed by the user
    "short_name": "my_session", // should be automatically generated, max 3 words, all lowercase, generated from the summary
    "description": "session_description", // should be automatically generated from an LLM summary of the session
    "created_at": "2022-01-01T00:00:00.000Z",
    "messages": [
        {
            "role": "user",
            "content": "session_content",
            "store": {
                "key": "value"
            }
        },
        {
            "role": "assistant",
            "content": "session_content",
        },
        {
            "role": "user",
            "content": "session_content",
            "store": {
                "key": "value"
            }
        },
        {
            "role": "assistant",
            "content": "session_content",
        }
    ]
}
```
