/**
 * The two HTTP transports. Both are plain `fetch` against a documented shape —
 * no provider SDK, because `OpenAICompatibleModel` alone covers OpenAI,
 * LM Studio, llama.cpp's server, Groq and OpenRouter, and a dependency per
 * provider buys nothing but upgrades to do.
 *
 * Neither has been run against a live endpoint from this repository's
 * development environment: the egress proxy blocks outbound HTTP to anything
 * but a short allowlist, and no Ollama runs here. The shapes below are the
 * documented ones and the parsing is covered by fixtures — but nobody has yet
 * seen either of these parse a real response. Say so rather than implying
 * otherwise.
 */
import type { ChatRequest, ChatResponse, LanguageModel } from './types.js';

async function postJson(url: string, body: unknown, signal: AbortSignal, headers: Record<string, string> = {}): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw new Error(`${url}: ${res.status} ${res.statusText}`);
  return res.json();
}

export interface OllamaOptions {
  readonly model: string;
  readonly baseUrl?: string;
}

/**
 * A model running on the machine. The default host is deliberately localhost:
 * a browser page served over HTTPS cannot reach it (mixed content), which is
 * exactly why the engine must run headless too — decision 0001.
 */
export function createOllamaModel(options: OllamaOptions): LanguageModel {
  const base = options.baseUrl ?? 'http://localhost:11434';
  return {
    id: `ollama:${options.model}`,
    supportsBatch: false,
    async complete(request: ChatRequest, signal: AbortSignal): Promise<ChatResponse> {
      const started = Date.now();
      const data = await postJson(`${base}/api/chat`, {
        model: options.model,
        messages: request.messages,
        stream: false,
        // Ollama's own constrained-output switch. Asked for, never trusted:
        // the parser validates regardless, because small models emit prose
        // around their JSON often enough that "format: json" is a hint.
        ...(request.json ? { format: 'json' } : {}),
        options: { temperature: request.temperature, num_predict: request.maxTokens },
      }, signal) as {
        message?: { content?: string };
        prompt_eval_count?: number;
        eval_count?: number;
      };
      return {
        text: data.message?.content ?? '',
        model: options.model,
        inputTokens: data.prompt_eval_count ?? null,
        outputTokens: data.eval_count ?? null,
        ms: Date.now() - started,
      };
    },
  };
}

export interface OpenAICompatibleOptions {
  readonly model: string;
  readonly baseUrl: string;
  /** Read from the caller, never from a literal in this repository. */
  readonly apiKey?: string;
}

export function createOpenAICompatibleModel(options: OpenAICompatibleOptions): LanguageModel {
  return {
    id: `openai:${options.model}`,
    supportsBatch: false,
    async complete(request: ChatRequest, signal: AbortSignal): Promise<ChatResponse> {
      const started = Date.now();
      const data = await postJson(
        `${options.baseUrl.replace(/\/$/, '')}/chat/completions`,
        {
          model: options.model,
          messages: request.messages,
          max_tokens: request.maxTokens,
          temperature: request.temperature,
          ...(request.json ? { response_format: { type: 'json_object' } } : {}),
        },
        signal,
        options.apiKey ? { Authorization: `Bearer ${options.apiKey}` } : {},
      ) as {
        choices?: { message?: { content?: string } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      return {
        text: data.choices?.[0]?.message?.content ?? '',
        model: options.model,
        inputTokens: data.usage?.prompt_tokens ?? null,
        outputTokens: data.usage?.completion_tokens ?? null,
        ms: Date.now() - started,
      };
    },
  };
}
