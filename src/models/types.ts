/**
 * Layer 1 of the inference split (decision 0004): transport, and nothing else.
 *
 * A `LanguageModel` knows an endpoint. It does not know what a dot is, it does
 * not build prompts, and it does not decide anything. Swapping one changes cost
 * and quality; it must never change what the world is asked.
 */

export interface ChatMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

export interface ChatRequest {
  readonly messages: readonly ChatMessage[];
  /** Asks the endpoint for JSON where it supports it. Never a substitute for validating. */
  readonly json: boolean;
  readonly maxTokens: number;
  readonly temperature: number;
}

export interface ChatResponse {
  readonly text: string;
  readonly model: string;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly ms: number;
}

export interface LanguageModel {
  readonly id: string;
  /** Whether several dots' requests can share one call. */
  readonly supportsBatch: boolean;
  complete(request: ChatRequest, signal: AbortSignal): Promise<ChatResponse>;
}
