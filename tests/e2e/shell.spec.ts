import { expect, test } from '@playwright/test';

test('club entrance renders at the repository subpath', async ({ page }) => {
  await page.goto('#/login');
  await expect(page).toHaveTitle('3DIGIT CLUB');
  await expect(page.getByRole('heading', { name: /Keep your promises/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enter the club' })).toBeVisible();
});

test('invalid club code produces an accessible notification', async ({ page }) => {
  await page.goto('#/login');
  await page.getByLabel('Club code').fill('20');
  await page.getByRole('button', { name: 'Enter the club' }).click();
  await expect(page.getByLabel('Notifications').getByRole('alert')).toContainText('Enter your four-digit club code.');
});

test('login shell has no horizontal overflow on phone, tablet, or desktop', async ({ page }) => {
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('#/login');
    const overflows = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflows, `horizontal overflow at ${width}px`).toBe(false);
  }
});

test('both members can open their shared week', async ({ browser }) => {
  test.skip(!process.env.TEST_MEMBER_LOGIN, 'Local fixtures are provided by verify-release.');
  for (const member of ['Catalina', 'Cristian']) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('#/login');
    await page.getByLabel('Member').selectOption(member.toLowerCase());
    await page.getByLabel('Club code').fill('2000');
    await page.getByRole('button', { name: 'Enter the club' }).click();
    await expect(page.getByRole('heading', { name: /history of showing up/i })).toBeVisible();
    for (const width of [375, 768, 1440]) {
      await page.setViewportSize({ width, height: 950 });
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), { message: `Home overflow at ${width}px` }).toBe(true);
    }
    await context.close();
  }
});
