/* @refresh reload */
import { render } from 'solid-js/web';
import { createSignal, onMount, For  } from 'solid-js';
import { VsCodeApi } from './vscode';
import type { SessionTree, SessionTreeNode, ExtensionToWebviewMessage } from '../shared/types';

function handleClick(){
  VsCodeApi.postMessage({ command: 'newSession', text: "example-session-title" });
}

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

  const requestSessionTree = () => {
    VsCodeApi.postMessage({ command: 'requestSessionTree' });
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
      <button 
        onClick={handleClick}
        style="background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 5px 10px; cursor: pointer;"
      >
        +
      </button>
      
      <button 
        onClick={requestSessionTree}
        style="background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 5px 10px; cursor: pointer; margin-left: 8px;"
      >
        Refresh
      </button>

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