import OpenAI from 'openai';
import { LLMMessage, LLMProvider, StreamChunk } from '../llmClient.js';

export interface OpenAIConfig {
    baseUrl: string;
    apiKey: string;
    model: string;
}

export class OpenAIProvider implements LLMProvider {
    private client: OpenAI;

    constructor(private readonly config: OpenAIConfig) {
        this.client = new OpenAI({
            baseURL: config.baseUrl,
            apiKey: config.apiKey,
        });
    }

    async chat(messages: LLMMessage[]): Promise<string> {
        const response = await this.client.chat.completions.create({
            model: this.config.model,
            messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
        });

        return response.choices[0]?.message?.content || '';
    }

    async *chatStream(messages: LLMMessage[]): AsyncGenerator<StreamChunk, void, unknown> {
        const stream = await this.client.chat.completions.create({
            model: this.config.model,
            messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
            stream: true,
            stream_options: { include_usage: true },
        });

        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta as any;

            if (delta?.reasoning_content) {
                yield { type: 'reasoning', text: delta.reasoning_content };
            }
            if (delta?.content) {
                yield { type: 'content', text: delta.content };
            }

            if (chunk.usage) {
                yield {
                    type: 'usage',
                    usage: {
                        promptTokens: chunk.usage.prompt_tokens,
                        completionTokens: chunk.usage.completion_tokens,
                        totalTokens: chunk.usage.total_tokens
                    }
                };
            }
        }
    }
}
