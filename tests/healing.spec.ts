import { expect, test } from '@playwright/test';
import { HealingPage } from '../src/healer.js';
import { PatchWriter } from '../src/patch-writer.js';

test('heals Login to Sign in and performs the click', async ({ page }) => {
  const patches = new PatchWriter();
  await page.setContent('<button id="sign-in">Sign in</button><output id="state"></output>');
  await page.locator('#sign-in').evaluate((button) => button.addEventListener('click', () => document.querySelector('#state')!.textContent = 'clicked'));

  await new HealingPage(page, { patchWriter: patches }).locator('#login').click();

  await expect(page.locator('#state')).toHaveText('clicked');
  expect(patches.getEvents()[0]).toMatchObject({ original: '#login', healed: '#sign-in' });
  expect(patches.getEvents()[0].score).toBeGreaterThan(0.95);
});

test('does not heal Search to an unrelated Filter control', async ({ page }) => {
  await page.setContent('<button id="filter">Filter</button>');
  await expect(new HealingPage(page).locator('#search').click()).rejects.toThrow(/could not safely heal/);
});