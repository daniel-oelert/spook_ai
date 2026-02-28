/* @refresh reload */
import { render } from 'solid-js/web';
import { createSignal, createEffect, onMount, For, Show } from 'solid-js';
import { VsCodeApi } from './vscode';
import './style.css'
import type { Message, Agent, ExtensionToWebviewMessage } from '../shared/types';
import {
  isReceiveMessageMessage,
  isAgentStatusMessage,
  isClearChatMessage
} from '../shared/index';

declare const sessionId: string;

function SessionPanel() {
  const [messages, setMessages] = createSignal<Message[]>([]);
  const [inputText, setInputText] = createSignal('');
  const [isTyping, setIsTyping] = createSignal(false);
  const [currentAgent, setCurrentAgent] = createSignal<Agent | null>(null);
  const [agents, setAgents] = createSignal<Agent[]>([
    { id: '1', name: 'Code Assistant', status: 'idle', icon: '🤖' },
    { id: '2', name: 'Debugger', status: 'idle', icon: '🔍' },
  ]);
  const [messagesEndRef, setMessagesEndRef] = createSignal<HTMLDivElement | null>(null);

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
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: message.role || 'assistant',
          content: message.content,
          timestamp: new Date(),
          agentStatus: message.agentStatus
        }]);
        setIsTyping(false);
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

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusIndicator = (status?: string) => {
    switch (status) {
      case 'thinking':
        return <span class="status-indicator thinking">💭 Thinking</span>;
      case 'processing':
        return <span class="status-indicator processing">⚙️ Processing</span>;
      case 'error':
        return <span class="status-indicator error">❌ Error</span>;
      default:
        return null;
    }
  };

  return (
    <div class="chat-container">
      {/* Header */}
      <div class="chat-header">
        <div class="header-left">
          <h2 class="chat-title">🤖 Agentic AI Chat</h2>
          <Show when={currentAgent()}>
            <span class="active-agent">
              {currentAgent()?.icon} {currentAgent()?.name}
            </span>
          </Show>
        </div>
        <div class="header-actions">
          <button
            class="icon-button"
            onClick={() => VsCodeApi.postMessage({ command: 'clearChat' })}
            title="Clear chat"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Agent Status Bar */}
      <Show when={agents().length > 0}>
        <div class="agent-status-bar">
          <For each={agents()}>
            {(agent) => (
              <div class={`agent-badge ${agent.status}`}>
                <span class="agent-icon">{agent.icon}</span>
                <span class="agent-name">{agent.name}</span>
                <span class={`agent-status-dot ${agent.status}`}></span>
              </div>
            )}
          </For>
        </div>
      </Show>

      {/* Messages Area */}
      <div class="messages-container">
        <Show when={messages().length === 0}>
          <div class="empty-state">
            <div class="empty-icon">💬</div>
            <h3>Start a conversation in session {sessionId}</h3>
            <p>Ask me anything about your code, debugging, or development tasks.</p>
            <div class="suggestion-chips">
              <button
                class="suggestion-chip"
                onClick={() => setInputText("Explain this code")}
              >
                Explain this code
              </button>
              <button
                class="suggestion-chip"
                onClick={() => setInputText("Find and fix bugs")}
              >
                Find and fix bugs
              </button>
              <button
                class="suggestion-chip"
                onClick={() => setInputText("Refactor this function")}
              >
                Refactor this function
              </button>
            </div>
          </div>
        </Show>

        <For each={messages()}>
          {(message) => (
            <div class={`message ${message.role}`}>
              <div class="message-header">
                <span class="message-role">
                  {message.role === 'user' ? '👤 You' : '🤖 Assistant'}
                </span>
                <span class="message-time">{formatTime(message.timestamp)}</span>
              </div>
              <div class="message-content">
                {message.content}
              </div>
              {getStatusIndicator(message.agentStatus)}
            </div>
          )}
        </For>

        {/* Typing Indicator */}
        <Show when={isTyping()}>
          <div class="message assistant typing">
            <div class="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </Show>

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div class="input-container">
        <textarea
          class="message-input"
          placeholder="Type your message... (Shift+Enter for new line)"
          value={inputText()}
          onInput={(e) => setInputText(e.currentTarget.value)}
          onKeyDown={handleKeyPress}
          rows={1}
        />
        <button
          class="send-button"
          onClick={handleSendMessage}
          disabled={!inputText().trim()}
          title="Send message"
        >
          <span class="send-icon">➤</span>
        </button>
      </div>
    </div>
  );
}

const root = document.getElementById('root');
render(() => <SessionPanel />, root!);