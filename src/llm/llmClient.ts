export interface LLMMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface TokenUsage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
}

export type StreamChunk =
    | { type: 'content'; text: string }
    | { type: 'reasoning'; text: string }
    | { type: 'usage'; usage: TokenUsage };

export interface LLMProvider {
    /** Generates a complete response (non-streaming) */
    chat(messages: LLMMessage[]): Promise<string>;

    /** Generates a streaming response, yielding chunks of text or metadata */
    chatStream(messages: LLMMessage[]): AsyncGenerator<StreamChunk, void, unknown>;
}
