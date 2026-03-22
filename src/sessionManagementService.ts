import path from 'path';
import * as vscode from 'vscode';
import { SessionTree } from '../shared/index.js';

import { SessionStore } from './session/sessionStore.js';

export class SessionManagementService {

    private sessionPanelMap = new Map<string, { panel: vscode.WebviewPanel }>();
    private onSessionTreeChangeCallback?: () => void;
    private sessionStore: SessionStore | null = null;

    constructor(private readonly _context: vscode.ExtensionContext) {
        const rootPath = vscode.workspace.workspaceFolders?.[0]?.uri;
        if (rootPath) {
            this.sessionStore = new SessionStore(rootPath);
        }
    }

    public async newSession(): Promise<void> {
        if (!this.sessionStore) {
            vscode.window.showErrorMessage('No workspace folder open for session storage.');
            return;
        }

        const newSessionId = `session_${Date.now()}`;
        await this.sessionStore.saveSession(newSessionId, {
            name: `New Session`,
            short_name: newSessionId,
            description: "A newly created session.",
            created_at: new Date().toISOString(),
            messages: []
        });

        const panel = vscode.window.createWebviewPanel(
            `sessionPanel_${newSessionId}`, // Internal ID
            `Session ${newSessionId}`, // Title shown to user
            vscode.ViewColumn.Active,
            {
                localResourceRoots: [vscode.Uri.file(path.join(this._context.extensionPath, 'out', 'webview',))],
                enableScripts: true, // Allow JS in the webview
            }
        );

        this.sessionPanelMap.set(newSessionId, { panel });

        panel.webview.html = SessionManagementService.getWebviewContent(panel.webview, this._context, newSessionId);

        panel.webview.onDidReceiveMessage(message => {
            if (message.command === 'alert') {
                vscode.window.showInformationMessage(message.text);
            }
        });

        this.notifySessionTreeChange();
    }

    public async getSessionTree(): Promise<SessionTree> {
        if (!this.sessionStore) {
            return { roots: [] };
        }
        const sessions = await this.sessionStore.getSessions();
        const roots = sessions.map(s => ({
            sessionId: s.id,
            name: s.name
        }));
        return { roots };
    }

    public setOnSessionTreeChangeCallback(callback: () => void): void {
        this.onSessionTreeChangeCallback = callback;
    }

    private notifySessionTreeChange(): void {
        if (this.onSessionTreeChangeCallback) {
            this.onSessionTreeChangeCallback();
        }
    }

    public static getWebviewContent(webview: vscode.Webview, context: vscode.ExtensionContext, sessionId: string) {

        const codiconsUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css'));
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'out', 'webview', 'sessionPanel.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'out', 'webview', 'style.css'));

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link href="${codiconsUri}" rel="stylesheet" />
            <link href="${styleUri}" rel="stylesheet" />
            <title>Session Management View</title>
        </head>
        <body>
            <div id="root"></div>
            <script type="module" src="${scriptUri}"></script>
            <script>
                const vscode = acquireVsCodeApi();
                const sessionId = "${sessionId}";
            </script>
        </body>
        </html>`;
    }
}