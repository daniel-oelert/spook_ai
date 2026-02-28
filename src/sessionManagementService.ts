import path from 'path';
import * as vscode from 'vscode';
import { SessionTree } from '../shared/index.js';

export class SessionManagementService {

    private sessionPanelMap = new Map<string, { panel: vscode.WebviewPanel }>();
    private onSessionTreeChangeCallback?: () => void;

    constructor(private readonly _context: vscode.ExtensionContext) { }

    public async newSession(): Promise<void> {

        var newSessionId = "1";

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
        return { roots: [] };
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