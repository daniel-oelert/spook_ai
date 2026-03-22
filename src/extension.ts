// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { SessionManagementViewProvider } from './sessionManagementViewProvider.js';
import { SessionManagementService } from './sessionManagementService.js';
import { runRudimentaryRLMSession } from './agent/rlm.js';
import { OpenAIProvider } from './llm/providers/openai.js';
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


    const testRLMDisposable = vscode.commands.registerCommand('spook.testRLM', async () => {
        const apiKey = await vscode.window.showInputBox({ prompt: "Enter OpenAI API Key", ignoreFocusOut: true, password: true });
        if (!apiKey) {return;}

        const prompt = await vscode.window.showInputBox({ prompt: "Enter a task for the Agent", ignoreFocusOut: true });
        if (!prompt) {return;}

        const provider = new OpenAIProvider({
            baseUrl: "http://192.168.2.210:8000/v1",
            apiKey,
            model: "nemotron_cascade_2_30b_a3b"
        });

        const outputChannel = vscode.window.createOutputChannel("Spook RLM Test");
        outputChannel.show(true);

        runRudimentaryRLMSession(prompt, {
            provider,
            outputChannel
        });
    });

    context.subscriptions.push(
        sessionManagementViewProviderDisposable,
        sessionDisposable,
        testRLMDisposable
    );
}

export function deactivate() {
}