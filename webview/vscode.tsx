import type { WebviewToExtensionMessage } from '../shared/types';

interface VsCodeApiInterface {
    postMessage(message: WebviewToExtensionMessage): void;
}

declare const vscode: VsCodeApiInterface;

export class VsCodeApi {
    public static postMessage(message: WebviewToExtensionMessage): void {
        vscode.postMessage(message);
    }
}