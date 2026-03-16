## Challenges

### Restarting sessions

The problem with restarting sessions is that they are stateful. Code has to be run, to arrive at the same state, that the session was in when it was stopped. This is not always possible or desirable, since the previous code might involve for example modifying project files. Therefore there needs to be a solution. 

The proposed solution is to use a custom key-value store of serializable Python objects, that the agent can write to in its commands. This key-value store will be persisted to disk, and will be loaded when the session is restarted. It will also be saved at every intermediate step, so that sessions can be resumed at any previous point in the conversation. 