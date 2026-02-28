/**
 * Shared types for communication between VSCode extension and webview.
 * This module defines the contract for data exchange via postMessage.
 */

// =============================================================================
// Session & Chat Types
// =============================================================================

/** Role of a message sender */
export type MessageRole = 'user' | 'assistant' | 'system';

/** Status of an agent during processing */
export type AgentStatus = 'thinking' | 'processing' | 'complete' | 'error';

/** Status of an agent */
export type AgentState = 'idle' | 'active' | 'thinking' | 'error';

/** A chat message */
export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  agentStatus?: AgentStatus;
}

/** An AI agent */
export interface Agent {
  id: string;
  name: string;
  status: AgentState;
  icon?: string;
}

/** A node in the session tree structure */
export interface SessionTreeNode {
  sessionId: string;
  name: string;
  children?: SessionTreeNode[];
  metadata?: { [key: string]: unknown };
}

/** Session tree representing the project structure */
export interface SessionTree {
  roots: SessionTreeNode[];
}

// =============================================================================
// Extension -> Webview Messages
// =============================================================================

/** Server status update message */
export interface ServerStatusMessage {
  command: 'serverStatus';
  status: string;
}

export interface RefreshNeededMessage {
  command: 'refresh'
}

/** Receive a chat message from the extension */
export interface ReceiveMessageMessage {
  command: 'receiveMessage';
  content: string;
  role?: MessageRole;
  agentStatus?: AgentStatus;
}

/** Agent status update message */
export interface AgentStatusMessage {
  command: 'agentStatus';
  agent: Agent;
  status: AgentState;
}

/** Clear chat message */
export interface ClearChatMessage {
  command: 'clearChat';
}

/** Session tree update message from extension to webview */
export interface SessionTreeMessage {
  command: 'sessionTree';
  tree: SessionTree;
}

/** Union type for all messages from extension to webview */
export type ExtensionToWebviewMessage =
  | ServerStatusMessage
  | ReceiveMessageMessage
  | AgentStatusMessage
  | ClearChatMessage
  | SessionTreeMessage;

// =============================================================================
// Webview -> Extension Messages
// =============================================================================

/** Send a query to the extension */
export interface SendQueryMessage {
  command: 'sendQuery';
  text: string;
}

/** Request server restart */
export interface RequestRestartMessage {
  command: 'requestRestart';
}

/** Request server status */
export interface RequestStatusMessage {
  command: 'requestStatus';
}

/** Request to clear chat */
export interface ClearChatRequestMessage {
  command: 'clearChat';
}

/** Request to create a new session */
export interface NewSessionMessage {
  command: 'newSession';
  text?: string;
}

/** Request the session tree */
export interface RequestSessionTreeMessage {
  command: 'requestSessionTree';
}

/** Union type for all messages from webview to extension */
export type WebviewToExtensionMessage =
  | SendQueryMessage
  | RequestRestartMessage
  | RequestStatusMessage
  | ClearChatRequestMessage
  | NewSessionMessage
  | RequestSessionTreeMessage;

// =============================================================================
// Type Guards
// =============================================================================

/** Type guard for ServerStatusMessage */
export function isServerStatusMessage(msg: unknown): msg is ServerStatusMessage {
  return typeof msg === 'object' && msg !== null && (msg as ServerStatusMessage).command === 'serverStatus';
}

/** Type guard for ReceiveMessageMessage */
export function isReceiveMessageMessage(msg: unknown): msg is ReceiveMessageMessage {
  return typeof msg === 'object' && msg !== null && (msg as ReceiveMessageMessage).command === 'receiveMessage';
}

/** Type guard for AgentStatusMessage */
export function isAgentStatusMessage(msg: unknown): msg is AgentStatusMessage {
  return typeof msg === 'object' && msg !== null && (msg as AgentStatusMessage).command === 'agentStatus';
}

/** Type guard for ClearChatMessage */
export function isClearChatMessage(msg: unknown): msg is ClearChatMessage {
  return typeof msg === 'object' && msg !== null && (msg as ClearChatMessage).command === 'clearChat';
}

/** Type guard for SessionTreeMessage */
export function isSessionTreeMessage(msg: unknown): msg is SessionTreeMessage {
  return typeof msg === 'object' && msg !== null && (msg as SessionTreeMessage).command === 'sessionTree';
}

/** Type guard for RequestSessionTreeMessage */
export function isRequestSessionTreeMessage(msg: unknown): msg is RequestSessionTreeMessage {
  return typeof msg === 'object' && msg !== null && (msg as RequestSessionTreeMessage).command === 'requestSessionTree';
}