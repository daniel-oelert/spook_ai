/* @refresh reload */
import { render } from 'solid-js/web';
import { createSignal, createEffect, onMount, For, Show, Index } from 'solid-js';
import { VsCodeApi } from './vscode';
import './style.css'
import type { Message, Agent, ExtensionToWebviewMessage } from '../shared/types';
import {
  isReceiveMessageMessage,
  isAgentStatusMessage,
  isClearChatMessage
} from '../shared/index';

declare const sessionId: string;

function ThinkBlock(props: { content: string }) {
  const [isCollapsed, setIsCollapsed] = createSignal(true);
  return (
    <div class="assistant-timeline-node think-node">
      <div class="timeline-dot asterisk">✱</div>
      <div class="timeline-content">
        <div class="think-header" onClick={() => setIsCollapsed(!isCollapsed())}>
          <span class="think-title">Thinking...</span>
        </div>
        <Show when={!isCollapsed()}>
          <div class="text-block">{props.content}</div>
        </Show>
      </div>
    </div>
  );
}

function MessageRenderer(props: { content: string }) {
  const blocks = () => {
    const text = props.content;
    const result: { type: 'text' | 'think'; content: string }[] = [];
    const thinkRegex = /<think>([\s\S]*?)(?:<\/think>|$)/g;
    let lastIndex = 0;
    let match;

    while ((match = thinkRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        result.push({ type: 'text', content: text.slice(lastIndex, match.index).trim() });
      }
      result.push({ type: 'think', content: match[1].trim() });
      lastIndex = thinkRegex.lastIndex;
    }
    if (lastIndex < text.length) {
      const remaining = text.slice(lastIndex).trim();
      if (remaining) {
        result.push({ type: 'text', content: remaining });
      }
    }
    return result;
  };

  const renderTextNodes = (content: string) => {
    const lines = content.split('\n');
    let currentBlock = '';
    const output: { type: 'normal' | 'read' | 'write' | 'code'; text: string; subtext?: string }[] = [];

    const flushBlock = () => {
      if (currentBlock.trim()) {
        output.push({ type: 'normal', text: currentBlock.trim() });
        currentBlock = '';
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.match(/^Read\s+`?.*?`?/)) {
        flushBlock();
        let subtext = '';
        if (i + 1 < lines.length && lines[i + 1].trim().startsWith('L Read')) {
          subtext = lines[i + 1].trim();
          i++; // skip next line
        }
        output.push({ type: 'read', text: line, subtext });
      } else if (line.match(/^Write\s*\(.*?\)/)) {
        flushBlock();
        let codeContent = '';
        // If next line starts code block, grab it
        if (i + 1 < lines.length && lines[i + 1].trim().startsWith('```')) {
          i++;
          const lang = lines[i].trim().replace('```', '');
          let insideCode = '';
          i++;
          while (i < lines.length && !lines[i].trim().startsWith('```')) {
            insideCode += lines[i] + '\n';
            i++;
          }
          codeContent = insideCode.trim();
        }
        output.push({ type: 'write', text: line, subtext: codeContent });
      } else {
        currentBlock += (currentBlock ? '\n' : '') + line;
      }
    }
    flushBlock();
    return output;
  };

  return (
    <div class="message-content-wrapper">
      <Index each={blocks()}>
        {(block) => (
          block().type === 'think' ?
            <ThinkBlock content={block().content} /> :
            <div class="text-blocks">
              <Index each={renderTextNodes(block().content)}>
                {(node) => (
                  <div class="assistant-timeline-node text-node">
                    <div class={`timeline-dot ${(node().type === 'read' || node().type === 'write') ? 'green' : 'grey'}`}></div>
                    <div class="timeline-content">
                      <div class={node().type !== 'normal' ? 'action-text' : 'text-block'}>
                        {node().text}
                      </div>
                      <Show when={node().type === 'read' && node().subtext}>
                        <div class="action-subtext">{node().subtext}</div>
                      </Show>
                      <Show when={node().type === 'write' && node().subtext}>
                        <div class="code-highlight">{node().subtext}</div>
                      </Show>
                    </div>
                  </div>
                )}
              </Index>
            </div>
        )}
      </Index>
    </div>
  );
}

function SessionPanel() {
  const [messages, setMessages] = createSignal<Message[]>([]);
  const [inputText, setInputText] = createSignal('');
  const [isTyping, setIsTyping] = createSignal(false);
  const [currentAgent, setCurrentAgent] = createSignal<Agent | null>(null);
  const [agents, setAgents] = createSignal<Agent[]>([
    { id: '1', name: 'Code Assistant', status: 'idle', icon: '🤖' },
  ]);
  const [messagesEndRef, setMessagesEndRef] = createSignal<HTMLDivElement | null>(null);

  const isAgentWorking = () => isTyping() || agents().some(a => a.status === 'thinking' || a.status === 'active');

  // Auto-scroll to bottom when messages change
  createEffect(() => {
    const end = messagesEndRef();
    if (end) {
      end.scrollIntoView({ behavior: 'smooth' });
    }
  });

  // Listen for messages from VSCode extension
  onMount(() => {
    window.addEventListener('message', (event) => {
      const message = event.data as ExtensionToWebviewMessage;

      if (isReceiveMessageMessage(message)) {
        if (message.messageId) {
          setMessages(prev => {
            const existingIndex = prev.findIndex(m => m.id === message.messageId);
            if (existingIndex >= 0) {
              const newMessages = [...prev];
              newMessages[existingIndex] = {
                ...newMessages[existingIndex],
                content: message.content,
                agentStatus: message.agentStatus || newMessages[existingIndex].agentStatus
              };
              return newMessages;
            } else {
              return [...prev, {
                id: message.messageId!,
                role: message.role || 'assistant',
                content: message.content,
                timestamp: new Date(),
                agentStatus: message.agentStatus
              }];
            }
          });
        } else {
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: message.role || 'assistant',
            content: message.content,
            timestamp: new Date(),
            agentStatus: message.agentStatus
          }]);
        }

        if (!message.isPartial) {
          setIsTyping(false);
        }
      } else if (isAgentStatusMessage(message)) {
        setCurrentAgent(message.agent);
        setIsTyping(message.agent.status === 'thinking' || message.agent.status === 'active');
      } else if (isClearChatMessage(message)) {
        setMessages([]);
      }
    });
  });

  const handleSendMessage = () => {
    const text = inputText().trim();
    if (!text) return;

    // Add user message
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date()
    }]);

    // Send to extension
    VsCodeApi.postMessage({ command: 'sendQuery', text });
    setInputText('');
    setIsTyping(true);
  };

  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div class="chat-container">
      {/* Header */}
      <div class="chat-header">
        <div class="header-left">
          <h2 class="chat-title">
            Unit Tests <span class="chevron">⌄</span>
          </h2>
        </div>
        <div class="header-actions">
          <button class="icon-button" title="New Chat">
            <svg viewBox="0 0 16 16"><path d="M11.5 2h-7C3.67 2 3 2.67 3 3.5v7c0 .83.67 1.5 1.5 1.5h2v2.5L9.5 12h2c.83 0 1.5-.67 1.5-1.5v-7c0-.83-.67-1.5-1.5-1.5zm-3 5h-1v1h-1V7h-1V6h1V5h1v1h1v1h-1z" /></svg>
          </button>
          <button
            class="icon-button"
            onClick={() => VsCodeApi.postMessage({ command: 'clearChat' })}
            title="Clear chat"
          >
            <svg viewBox="0 0 16 16"><path d="M12 4.7L11.3 4 8 7.3 4.7 4 4 4.7 7.3 8 4 11.3 4.7 12 8 8.7 11.3 12 12 11.3 8.7 8 12 4.7z" /></svg>
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div class="messages-container">
        <For each={messages()}>
          {(message) => (
            <div class={`message ${message.role}`}>
              <Show when={message.role === 'user'}>
                <div class="user-message-box">
                  {message.content}
                </div>
              </Show>
              <Show when={message.role === 'assistant'}>
                <div class="assistant-message-wrapper">
                  <MessageRenderer content={message.content} />
                </div>
              </Show>
            </div>
          )}
        </For>

        {/* Typing Indicator */}
        <Show when={isTyping()}>
          <div class="message assistant typing">
            <div class="assistant-timeline-node pondering">
              <div class="timeline-dot asterisk">✱</div>
              <div class="timeline-content">
                <span class="text-block">Thinking...</span>
              </div>
            </div>
          </div>
        </Show>

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div class="input-container">
        <div class="input-wrapper">
          <textarea
            class="message-input"
            placeholder={isAgentWorking() ? "Agent is working..." : "Queue another message..."}
            value={inputText()}
            disabled={isAgentWorking()}
            onInput={(e) => setInputText(e.currentTarget.value)}
            onKeyDown={handleKeyPress}
            rows={1}
          />
          <div class="input-actions">
            <div class="input-actions-left">
              <span class="input-action-pill">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M11 2.5C11 1.12 9.88 0 8.5 0S6 1.12 6 2.5v7.08c0 1.05.85 1.91 1.9 1.92h.1c1.05 0 1.9-.85 1.9-1.92V4.4h-1v5.18c0 .5-.45.92-.95.92-.5 0-.95-.42-.95-.92V2.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5V11H12V2.5z" /></svg>
                Ask before editing
              </span>
              <span class="input-action-pill">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M11 2.5C11 1.12 9.88 0 8.5 0S6 1.12 6 2.5v7.08c0 1.05.85 1.91 1.9 1.92h.1c1.05 0 1.9-.85 1.9-1.92V4.4h-1v5.18c0 .5-.45.92-.95.92-.5 0-.95-.42-.95-.92V2.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5V11H12V2.5z" /></svg>
                localizationUtils.ts
              </span>
            </div>
            <div class="input-actions-right">
              <span class="input-slash">/</span>
              <button
                class="submit-btn"
                onClick={handleSendMessage}
                disabled={!inputText().trim() || isAgentWorking()}
                title="Send message"
              >
                <div class="submit-icon"></div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const root = document.getElementById('root');
render(() => <SessionPanel />, root!);