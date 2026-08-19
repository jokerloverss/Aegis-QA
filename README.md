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

The current MVP uses explainable local DOM and semantic matching. It intentionally fails when the replacement has a different semantic family, such as `Search` becoming `Filter`.
