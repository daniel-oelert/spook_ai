/* @refresh reload */
import { render } from 'solid-js/web';
import { createSignal, onMount, For } from 'solid-js';
import { VsCodeApi } from './vscode';
import type { SessionTree, SessionTreeNode, ExtensionToWebviewMessage } from '../shared/types';

function SessionTreeNodeComponent(props: { node: SessionTreeNode }) {
  return (
    <div style="margin-left: 16px;">
      <div style="padding: 4px 0; color: var(--vscode-foreground);">
        {props.node.name}
      </div>
      {props.node.children && props.node.children.length > 0 && (
        <div>
          <For each={props.node.children}>
            {(child) => <SessionTreeNodeComponent node={child} />}
          </For>
        </div>
      )}
    </div>
  );
}

function SessionManagementView() {
  const [sessionTree, setSessionTree] = createSignal<SessionTree | null>(null);
  const [prompt, setPrompt] = createSignal('');

  const requestSessionTree = () => {
    VsCodeApi.postMessage({ command: 'requestSessionTree' });
  };

  const handleStartSession = () => {
    VsCodeApi.postMessage({ command: 'newSession', text: prompt() || "example-session-title" });
    setPrompt('');
  };

  onMount(() => {
    // Request initial session tree
    requestSessionTree();

    // Listen for messages from extension
    window.addEventListener('message', (event) => {
      const message = event.data as ExtensionToWebviewMessage;

      switch (message.command) {
        case 'sessionTree':
          setSessionTree(message.tree);
          break;
      }
    });
  });

  return (
    <div style="padding: 20px; color: white;">
      <div style="display: flex; gap: 8px; margin-bottom: 16px;">
        <input
          type="text"
          value={prompt()}
          onInput={(e) => setPrompt(e.currentTarget.value)}
          placeholder="Enter a task for the Agent"
          style="flex: 1; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); padding: 5px; border-radius: 2px;"
        />
        <button
          onClick={handleStartSession}
          style="background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 5px 10px; cursor: pointer; border-radius: 2px;"
        >
          Run RLM
        </button>
        <button
          onClick={requestSessionTree}
          style="background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 5px 10px; cursor: pointer; border-radius: 2px;"
        >
          Refresh
        </button>
      </div>

      <div style="margin-top: 16px;">
        <h3 style="color: var(--vscode-foreground); margin-bottom: 8px;">Sessions</h3>
        {sessionTree() ? (
          <For each={sessionTree()?.roots}>
            {(root) => <SessionTreeNodeComponent node={root} />}
          </For>
        ) : (
          <div style="color: var(--vscode-descriptionForeground);">Loading sessions...</div>
        )}
      </div>
    </div>
  );
}

const root = document.getElementById('root');
render(() => <SessionManagementView />, root!);