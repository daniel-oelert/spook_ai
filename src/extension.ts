// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { SessionManagementViewProvider } from './sessionManagementViewProvider.js';
// 2. Initialize Pyodide Singleton
import { SessionManagementService } from './sessionManagementService.js';
import { Server } from 'http';

let logger: vscode.LogOutputChannel;

export function getLogger(): vscode.LogOutputChannel {
    return logger;
}

export async function activate(context: vscode.ExtensionContext) {

    let config = vscode.workspace.getConfiguration('spook');

    logger = vscode.window.createOutputChannel("Spook", { log: true });
    context.subscriptions.push(logger);

    logger.info("Spook extension activated", {
        workspaceFolder: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
        extensionPath: context.extensionPath,
    });


    const sessionManagementService = new SessionManagementService(context);

    // Register the provider for the view contributed in package.json
    const sessionManagementViewProvider = new SessionManagementViewProvider(context, sessionManagementService, logger);
    const sessionManagementViewProviderDisposable = vscode.window.registerWebviewViewProvider('spook.sessionManagementView', sessionManagementViewProvider);

    const sessionDisposable = vscode.commands.registerCommand('spook.session', async () => {
        await vscode.commands.executeCommand('workbench.view.extension.spook');
    });


    context.subscriptions.push(
        sessionManagementViewProviderDisposable,
        sessionDisposable);
}

export function deactivate() {
}