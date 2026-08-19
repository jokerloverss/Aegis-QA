# Aegis-QA

Local, confidence-gated self-healing for Playwright tests.

## Quick start

```sh
npm install
npx playwright install chromium
npm test
```

## Usage

Wrap a Playwright `Page` and use the SDK for actions that may need healing:

```ts
const aegis = new HealingPage(page, { threshold: 0.95 });
await aegis.locator('#login').click();
```

The original locator is always used first. Healing runs only after it fails, and a candidate is accepted only when its confidence is strictly greater than `95%` and clearly ahead of the next candidate. Every accepted repair is exposed through `PatchWriter` and written as JSON for review.

The healing flow is agentic: it observes the failed locator and DOM context, asks a local Ollama model to reason about intent, verifies the action and confidence, performs the action, and records the repair. If Ollama is unavailable, it falls back to explainable local reasoning. It intentionally fails when the replacement has a different purpose, such as `Search` becoming `Filter`.

To enable the local model, install Ollama and pull a small model:

```sh
ollama run qwen2.5:3b
```

The SDK calls `http://127.0.0.1:11434` and sends only the failed locator, requested action, and structured DOM candidate context.
