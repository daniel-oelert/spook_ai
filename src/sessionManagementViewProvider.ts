import * as vscode from 'vscode';
import { SessionManagementService } from "./sessionManagementService.js";
import type { WebviewToExtensionMessage } from './model.js';

export class SessionManagementViewProvider implements vscode.WebviewViewProvider {

    private sessionManagementService: SessionManagementService;
    private logger: vscode.LogOutputChannel;
    private _webviewView?: vscode.WebviewView;

    constructor(private readonly _context: vscode.ExtensionContext, sessionManagementService: SessionManagementService, logger: vscode.LogOutputChannel
    ) {
        this.sessionManagementService = sessionManagementService;
        this.logger = logger;

        // Register callback for session tree changes
        this.sessionManagementService.setOnSessionTreeChangeCallback(() => this.onSessionTreeChanged());
    }

    public resolveWebviewView(webviewView: vscode.WebviewView) {

        this._webviewView = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._context.extensionUri],
        };

        webviewView.webview.html = SessionManagementViewProvider.getWebviewContent(webviewView.webview, this._context);

        webviewView.webview.onDidReceiveMessage(async (message) => {
            this.logger.trace("Message from view received", { message: message });
            switch (message.command) {
                case 'newSession': {
                    const query = String(message.text || '');
                    this.logger.info('Creating new session' + query);
                    this.sessionManagementService.newSession();
                    // webviewView.webview.postMessage({ command: 'serverStatus', status: s.status, metadata: { port: s.port, pid: s.pid } });
                    break;
                }

                case 'requestSessionTree': {
                    this.logger.info('Session tree requested');
                    try {
                        const tree = await this.sessionManagementService.getSessionTree();
                        webviewView.webview.postMessage({
                            command: 'sessionTree',
                            tree: tree
                        });
                    } catch (error) {
                        this.logger.error('Failed to get session tree', error);
                        vscode.window.showErrorMessage('Failed to fetch session tree');
                    }
                    break;
                }

            }
        });
        this.logger.info("onDidReceiveMessage handler attached");

        // Clear currentView when the view is disposed
        webviewView.onDidDispose(() => {
            this._webviewView = undefined;
        });
    }

    private async onSessionTreeChanged(): Promise<void> {
        if (!this._webviewView) {
            this.logger.trace('Webview not available, skipping session tree update');
            return;
        }

        this.logger.info('Session tree changed, sending update to frontend');
        try {
            const tree = await this.sessionManagementService.getSessionTree();
            this._webviewView.webview.postMessage({
                command: 'sessionTree',
                tree: tree
            });
        } catch (error) {
            this.logger.error('Failed to send session tree update', error);
        }
    }

    public static getWebviewContent(webview: vscode.Webview, context: vscode.ExtensionContext) {

        const codiconsUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css'));
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'out', 'webview', 'sessionManagement.js'));

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link href="${codiconsUri}" rel="stylesheet" />
            <title>Session Management View</title>
        </head>
        <body>
            <div id="root"></div>
            <script type="module" src="${scriptUri}"></script>
            <script>
                const vscode = acquireVsCodeApi();
            </script>
        </body>
        </html>`;
    }

    // return `
    //     <!DOCTYPE html>
    //     <html lang="en">
    //     <head>
    //         <meta charset="UTF-8">
    //         <meta name="viewport" content="width=device-width, initial-scale=1.0">
    //         <link href="${codiconsUri}" rel="stylesheet" />
    //         <style>
    //             body {
    //                 display: flex;
    //                 flex-direction: column;
    //                 height: 100vh;
    //                 margin: 0;
    //                 padding: 0;
    //                 color: var(--vscode-editor-foreground);
    //                 font-family: var(--vscode-font-family);
    //                 background-color: var(--vscode-sideBar-background);
    //             }

    //             #chat-container {
    //                 flex: 1;
    //                 overflow-y: auto;
    //                 padding: 15px;
    //                 display: flex;
    //                 flex-direction: column;
    //                 gap: 12px;
    //             }

    //             .message {
    //                 max-width: 90%;
    //                 padding: 8px 12px;
    //                 border-radius: 6px;
    //                 line-height: 1.4;
    //                 font-size: var(--vscode-editor-font-size);
    //             }

    //             .user-message {
    //                 align-self: flex-end;
    //                 background-color: var(--vscode-button-background);
    //                 color: var(--vscode-button-foreground);
    //             }

    //             .agent-message {
    //                 align-self: flex-start;
    //                 background-color: var(--vscode-editor-background);
    //                 border: 1px solid var(--vscode-widget-border);
    //             }

    //             #input-container {
    //                 padding: 15px;
    //                 background-color: var(--vscode-sideBar-background);
    //                 border-top: 1px solid var(--vscode-widget-border);
    //                 display: flex;
    //                 flex-direction: column;
    //                 gap: 8px;
    //             }

    //             textarea {
    //                 width: 100%;
    //                 background: var(--vscode-input-background);
    //                 color: var(--vscode-input-foreground);
    //                 border: 1px solid var(--vscode-input-border);
    //                 padding: 8px;
    //                 resize: none;
    //                 border-radius: 4px;
    //                 outline-color: var(--vscode-focusBorder);
    // 				font-family: var(--vscode-font-family);
    //             }

    //             .controls {
    //                 display: flex;
    //                 justify-content: flex-end;
    //                 align-items: center;
    //                 gap: 8px;
    //             }

    //             button {
    //                 background: var(--vscode-button-background);
    //                 color: var(--vscode-button-foreground);
    //                 border: none;
    //                 padding: 4px 12px;
    //                 cursor: pointer;
    //                 border-radius: 2px;
    //             }

    //             button:hover {
    //                 background: var(--vscode-button-hoverBackground);
    //             }

    //             .status-container {
    //                 display: inline-flex;
    //                 align-items: center;
    //                 gap: 8px;
    //                 font-size: 12px;
    //                 color: var(--vscode-foreground);
    //             }

    //             .status-dot {
    //                 width: 12px;
    //                 height: 12px;
    //                 border-radius: 50%;
    //                 background: #888;
    //                 display: inline-block;
    //                 vertical-align: middle;
    //                 border: none;
    //                 padding: 0;
    //                 margin: 0;
    //                 cursor: pointer;
    //             }

    //             .status-dot:focus {
    //                 outline: 2px solid var(--vscode-focusBorder);
    //                 outline-offset: 2px;
    //             }

    //             .status-dot.healthy { background: #0F9D58; }
    //             .status-dot.stopped { background: #777; }
    //             .status-dot.starting, .status-dot.restarting, .status-dot.stopping { background: #F6C343; }

    //             .status-text { font-size: 12px; opacity: 0.9; }

    //             #restartBtn {
    //                 display: flex;
    //                 align-items: center;
    //                 width: 16px;
    //                 height: 16px;
    //                 padding: 3px;
    //                 border-radius: 5px;
    //                 font-size: 16px;
    //                 color: var(--vscode-icon-foreground)
    //                 cursor: pointer;
    //             }
    //             #restartBtn:hover {
    //                 background-color: var(--vscode-toolbar-hoverBackground);
    //             }
    //         </style>
    //     </head>
    //     <body>
    //         <div id="chat-container">
    //             <div class="message agent-message">Hello! I'm Handlr. How can I help you today?</div>
    //         </div>

    //         <div id="input-container">
    //             <textarea id="userInput" rows="3" placeholder="Ask Handlr a question..."></textarea>
    //             <div class="controls">
    //                 <div class="status-container" title="Server status">
    //                     <button id="statusBtn" class="status-dot stopped" title="Status: unknown" aria-label="Refresh server status"></button>
    //                 </div>
    //                 <a id="restartBtn" role="button" title="Restart server" class="codicon codicon-refresh"></a>
    //                 <button id="sendBtn">Send</button>
    //             </div>
    //         </div>

    //         <script>
    //             const vscode = acquireVsCodeApi();
    //             const chatContainer = document.getElementById('chat-container');
    //             const userInput = document.getElementById('userInput');
    //             const sendBtn = document.getElementById('sendBtn');
    //             const restartBtn = document.getElementById('restartBtn');
    //             const statusBtn = document.getElementById('statusBtn');

    //             function addMessage(text, role) {
    //                 const msgDiv = document.createElement('div');
    //                 msgDiv.className = 'message ' + (role === 'user' ? 'user-message' : 'agent-message');
    //                 msgDiv.textContent = text;
    //                 chatContainer.appendChild(msgDiv);
    //                 chatContainer.scrollTop = chatContainer.scrollHeight;
    //             }

    //             function handleSend() {
    //                 const text = userInput.value.trim();
    //                 if (text) {
    //                     addMessage(text, 'user');
    //                     userInput.value = '';

    //                     // VSCode Message Communication
    //                     console.log('[Webview] Posting message to extension host', { command: 'sendQuery', text });
    //                     vscode.postMessage({ command: 'sendQuery', text: text });

    //                     // add a local placeholder
    //                     addMessage('Thinking...', 'agent');
    //                 }
    //             }

    //             function updateStatus(status, meta) {
    //                 const s = status || 'unknown';
    //                 if (statusBtn) {
    //                     statusBtn.className = 'status-dot ' + s;
    //                     statusBtn.removeAttribute('aria-busy');
    //                     let title = 'Status: ' + s;
    //                     if (meta) {
    //                         if (meta.port) title += '\nPort: ' + meta.port;
    //                         if (meta.pid) title += '\nPID: ' + meta.pid;
    //                         if (meta.uptime) title += '\nUptime: ' + meta.uptime;
    //                     }
    //                     statusBtn.title = title;
    //                 }
    //             }

    //             sendBtn.addEventListener('click', handleSend);
    //             restartBtn.addEventListener('click', () => {
    //                 // Ask extension host to show confirm dialog
    //                 vscode.postMessage({ command: 'requestRestart' });
    //             });

    //             if (statusBtn) {
    //                 statusBtn.addEventListener('click', () => {
    //                     statusBtn.setAttribute('aria-busy', 'true');
    //                     vscode.postMessage({ command: 'requestStatus' });
    //                 });
    //             }

    //             userInput.addEventListener('keydown', (e) => {
    //                 if (e.key === 'Enter' && !e.shiftKey) {
    //                     e.preventDefault();
    //                     handleSend();
    //                 }
    //             });

    //             window.addEventListener('message', event => {
    //                 const msg = event.data;
    //                 if (msg.command === 'agentResponse') {
    //                     addMessage(msg.text, 'agent');
    //                 } else if (msg.command === 'serverStatus') {
    //                     updateStatus(msg.status, msg.metadata);
    //                 }
    //             });
    //         </script>
    //     </body>
    //     </html>
    // `;
}