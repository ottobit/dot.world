---
id: recipes/add-a-model-provider
type: recipe
title: How do I add a model provider?
covers: [src/models/http.ts, src/node/run.ts]
exports: [createOllamaModel, createOpenAICompatibleModel, parseArgs]
depends_on: [contracts/language-model]
updated: 2026-09-05
---

# Adding a model provider

**When to open this page.** You want to run the world against an endpoint that
is not already supported.

**First check you need to.** `createOpenAICompatibleModel` already covers
OpenAI, LM Studio, llama.cpp's server, Groq and OpenRouter. Point it at the
base URL:

```sh
npm run world -- --ticks 300 --policy model \
  --model openai:llama-3.1-8b --base-url http://localhost:1234/v1
```

`OPENAI_API_KEY` is read from the environment. Never put a key in this
repository.

## If the endpoint really is different

1. Add a factory to `src/models/http.ts` returning a `LanguageModel`. It
   transports and nothing else — no prompt text, no decisions.
2. Report `inputTokens` / `outputTokens` when the endpoint gives them, `null`
   when it does not. Do not estimate: a made-up number is worse than none.
3. Throw on a non-OK response rather than parsing whatever came back.
4. Add a fixture test in `src/policies/model.test.ts` pinning the response
   shape, next to the Ollama and OpenAI ones.
5. Add the prefix to `buildLanguageModel` in `src/node/run.ts`.

## Then measure, and report what you find

```sh
npm run world -- --ticks 300 --seed 42 --dots 12 --policy model --model <spec>
```

The run prints deliberations, calls, retries, fallbacks, the share of replies
rejected with each failure named, and p50/p95 latency. **Report it even when it
is unflattering** — the rejection rate is the number that says whether a small
model can drive this world at all.

## See also

- [`contracts/language-model.md`](../contracts/language-model.md)
