import type { Locator, Page } from '@playwright/test';
import { PatchWriter } from './patch-writer.js';

export type HealingOptions = {
  threshold?: number;
  patchWriter?: PatchWriter;
  onHeal?: (event: HealingEvent) => void;
};

export type HealingEvent = {
  original: string;
  healed: string;
  score: number;
  reasons: string[];
};

type Candidate = {
  selector: string;
  role: string;
  name: string;
  text: string;
  id: string;
  testId: string;
  type: string;
  parentText: string;
};

const aliases: Record<string, string[]> = {
  login: ['login', 'sign in', 'signin', 'authenticate'],
  submit: ['submit', 'send', 'save', 'continue'],
  search: ['search', 'find', 'query'],
  filter: ['filter', 'refine', 'facet'],
};

function tokens(value: string): string[] {
  return value.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
}

function semanticFamily(value: string): string | undefined {
  const normalized = value.toLowerCase().replace(/[-_]/g, ' ');
  return Object.entries(aliases).find(([, words]) => words.some((word) => normalized.includes(word)))?.[0];
}

function cssEscape(value: string): string {
  return value.replace(/([\\.#:[\],>+~*'"() ])/g, '\\$1');
}

export class HealingPage {
  private readonly threshold: number;
  private readonly patchWriter: PatchWriter;
  private readonly onHeal?: (event: HealingEvent) => void;

  constructor(private readonly page: Page, options: HealingOptions = {}) {
    this.threshold = options.threshold ?? 0.95;
    this.patchWriter = options.patchWriter ?? new PatchWriter();
    this.onHeal = options.onHeal;
  }

  locator(selector: string): HealingLocator {
    return new HealingLocator(this, selector);
  }

  async resolve(selector: string): Promise<Locator> {
    const original = this.page.locator(selector);
    if (await original.count()) return original.first();

    const candidates = await this.page.locator('button, a, input, textarea, select, [role]').evaluateAll((elements) =>
      elements.map((element) => {
        const node = element as HTMLElement;
        const role = node.getAttribute('role') || node.tagName.toLowerCase();
        const name = node.getAttribute('aria-label') || node.textContent?.trim() || '';
        const id = node.id || '';
        const testId = node.getAttribute('data-testid') || '';
        const type = node.getAttribute('type') || '';
        const parentText = node.parentElement?.textContent?.trim() || '';
        const selectorValue = id ? `#${id}` : testId ? `[data-testid="${testId}"]` : '';
        return { selector: selectorValue, role, name, text: node.textContent?.trim() || '', id, testId, type, parentText };
      }),
    ) as Candidate[];

    const ranked = candidates
      .map((candidate) => ({ candidate, ...this.score(selector, candidate) }))
      .filter((item) => item.candidate.selector)
      .sort((left, right) => right.score - left.score);
    const winner = ranked[0];
    if (!winner || winner.score <= this.threshold || (ranked[1] && winner.score - ranked[1].score < 0.05)) {
      throw new Error(`Aegis could not safely heal locator ${selector}; best confidence was ${winner ? winner.score.toFixed(3) : '0.000'}`);
    }

    const event = { original: selector, healed: winner.candidate.selector, score: winner.score, reasons: winner.reasons };
    this.patchWriter.record(event);
    this.onHeal?.(event);
    return this.page.locator(winner.candidate.selector).first();
  }

  private score(selector: string, candidate: Candidate): { score: number; reasons: string[] } {
    const source = selector.replace(/[#[\]="']/g, ' ');
    const sourceTokens = tokens(source);
    const candidateText = `${candidate.name} ${candidate.text} ${candidate.id} ${candidate.testId}`;
    const sourceFamily = semanticFamily(source);
    const candidateFamily = semanticFamily(candidateText);
    const reasons: string[] = [];
    let score = 0;

    if (sourceFamily && sourceFamily === candidateFamily) {
      score += 0.90;
      reasons.push(`same semantic family: ${sourceFamily}`);
    } else if (sourceFamily && candidateFamily && sourceFamily !== candidateFamily) {
      return { score: 0, reasons: [`semantic mismatch: ${sourceFamily} vs ${candidateFamily}`] };
    }
    if (sourceTokens.some((token) => tokens(candidateText).includes(token))) {
      score += 0.10;
      reasons.push('shared locator token');
    }
    if (/button|role=button/.test(source) && /button|submit/.test(candidate.role + ' ' + candidate.type)) {
      score += 0.08;
      reasons.push('compatible button role');
    }
    return { score: Math.min(score, 0.99), reasons };
  }
}

export class HealingLocator {
  constructor(private readonly owner: HealingPage, private readonly selector: string) {}

  async click(): Promise<void> {
    await (await this.owner.resolve(this.selector)).click();
  }

  async fill(value: string): Promise<void> {
    await (await this.owner.resolve(this.selector)).fill(value);
  }
}