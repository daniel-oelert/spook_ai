import * as vscode from 'vscode';
import { SessionData } from '../../shared/types.js';

export class SessionStore {
    private readonly sessionsDir = '.spook/sessions';

    constructor(private readonly workspaceRoot: vscode.Uri) { }

    private getSessionsUri(): vscode.Uri {
        return vscode.Uri.joinPath(this.workspaceRoot, this.sessionsDir);
    }

    private getSessionUri(sessionId: string): vscode.Uri {
        // Enforce an extension.
        const idWithExt = sessionId.endsWith('.json') ? sessionId : `${sessionId}.json`;
        return vscode.Uri.joinPath(this.getSessionsUri(), idWithExt);
    }

    /**
     * Initializes the sessions directory if it doesn't already exist.
     */
    async initialize(): Promise<void> {
        try {
            await vscode.workspace.fs.createDirectory(this.getSessionsUri());
        } catch (error) {
            // Might already exist; safely ignore
        }
    }

    /**
     * Get a list of all existing sessions.
     */
    async getSessions(): Promise<{ id: string, name: string }[]> {
        await this.initialize();
        const results: { id: string, name: string }[] = [];
        const dirUri = this.getSessionsUri();

        try {
            const files = await vscode.workspace.fs.readDirectory(dirUri);

            for (const [name, type] of files) {
                if (type === vscode.FileType.File && name.endsWith('.json')) {
                    try {
                        const fileUri = vscode.Uri.joinPath(dirUri, name);
                        const contentBlob = await vscode.workspace.fs.readFile(fileUri);
                        const contentStr = new TextDecoder().decode(contentBlob);
                        const data: SessionData = JSON.parse(contentStr);
                        results.push({
                            id: name.replace('.json', ''),
                            name: data.name || name
                        });
                    } catch (err) {
                        console.error(`Failed to parse session file ${name}`, err);
                    }
                }
            }
        } catch (error) {
            console.error('Failed to read sessions directory', error);
        }

        return results;
    }

    /**
     * Read a specific session by ID.
     */
    async getSession(sessionId: string): Promise<SessionData | null> {
        const fileUri = this.getSessionUri(sessionId);
        try {
            const contentBlob = await vscode.workspace.fs.readFile(fileUri);
            const contentStr = new TextDecoder().decode(contentBlob);
            return JSON.parse(contentStr) as SessionData;
        } catch (error) {
            console.error(`Failed to read session ${sessionId}`, error);
            return null;
        }
    }

    /**
     * Save (create or update) a session.
     */
    async saveSession(sessionId: string, data: SessionData): Promise<void> {
        await this.initialize();
        const fileUri = this.getSessionUri(sessionId);
        const contentStr = JSON.stringify(data, null, 2);
        const contentBlob = new TextEncoder().encode(contentStr);
        await vscode.workspace.fs.writeFile(fileUri, contentBlob);
    }

    /**
     * Delete a session.
     */
    async deleteSession(sessionId: string): Promise<void> {
        const fileUri = this.getSessionUri(sessionId);
        try {
            await vscode.workspace.fs.delete(fileUri, { useTrash: true });
        } catch (error) {
            console.error(`Failed to delete session ${sessionId}`, error);
        }
    }
}
