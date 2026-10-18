import { test, expect } from '@playwright/test';

test('map selection survives safety responses and optional details stay intact', async ({ page }) => {
  await page.goto('/sos');
  await page.getByRole('button', { name: 'SOS', exact: true }).click();
  // Step 1: Emergency Type -> auto-advances to Step 2
  await page.getByRole('button', { name: 'Flood', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Is anyone in immediate danger?' })).toBeVisible();

  // Step 2: Danger Assessment -> select Yes -> auto-advances to Step 3
  await page.getByRole('radio', { name: 'Yes, immediate danger', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Where is the emergency?' })).toBeVisible();

  // Step 3: Location -> Choose on Map
  await page.getByRole('button', { name: 'Choose on Map', exact: true }).click();
  const map = page.getByRole('group', { name: 'Emergency location map', exact: true });
  await expect(page.getByRole('button', { name: 'Use map center', exact: true })).toBeEnabled();
  await map.click({ position: { x: 100, y: 100 } });
  await page.getByRole('button', { name: 'Confirm selected location', exact: true }).click();

  // Auto-advances to Step 4: Review & Send
  await expect(page.getByRole('heading', { name: 'Review & Send SOS' })).toBeVisible();
  await expect(page.getByText('Immediate danger reported')).toBeVisible();

  // Step 4: Expand Optional Details
  await page.getByText('Additional Details (Optional)', { exact: false }).click();
  await page.getByLabel('Your name', { exact: true }).fill('Test reporter');
  await expect(page.getByLabel('Your name', { exact: true })).toHaveValue('Test reporter');
});

test('API failure retains the report and translations preserve the safety response', async ({ page }) => {
  await page.route('http://localhost:4000/api/incidents', (route) =>
    route.fulfill({ status: 500, json: { success: false } })
  );

  await page.goto('/sos');
  await page.getByRole('button', { name: 'SOS', exact: true }).click();
  // Step 1: Select Flood
  await page.getByRole('button', { name: 'Flood', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Is anyone in immediate danger?' })).toBeVisible();

  // Step 2: Select Yes
  await page.getByRole('radio', { name: 'Yes, immediate danger', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Where is the emergency?' })).toBeVisible();

  // Test translations
  await page.getByRole('button', { name: 'اردو', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'ایمرجنسی کہاں ہے؟' })).toBeVisible();

  await page.getByRole('button', { name: 'سنڌي', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'ايمرجنسي ڪٿي آهي؟' })).toBeVisible();

  await page.getByRole('button', { name: 'English', exact: true }).click();
  await page.getByPlaceholder('Village, district, road, mosque or school').fill('Test landmark');
  await page.getByRole('button', { name: 'Continue to Review', exact: true }).click();

  // Step 4: Submit
  await expect(page.getByRole('heading', { name: 'Review & Send SOS' })).toBeVisible();
  await page.getByRole('button', { name: 'Send SOS Report', exact: true }).click();

  await expect(page.getByRole('alert').filter({ hasText: 'Your report was not recorded' })).toBeVisible();
  // Data preserved on step 4
  await expect(page.getByText('Test landmark')).toBeVisible();
});

test('optional safety check precedes location and submit; switching categories clears answers', async ({ page }) => {
  await page.goto('/sos');
  await page.getByRole('button', { name: 'SOS', exact: true }).click();
  // Step 1: Select Flood
  await page.getByRole('button', { name: 'Flood', exact: true }).click();

  // Step 2: Danger Assessment
  const step2Heading = page.getByRole('heading', { name: 'Is anyone in immediate danger?' });
  await expect(step2Heading).toBeVisible();
  await expect(page.locator('.rqContextQuestion')).toContainText('rising water');

  // Go back to Step 1
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'What happened?' })).toBeVisible();

  // Select Fire
  await page.getByRole('button', { name: 'Fire', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Is anyone in immediate danger?' })).toBeVisible();
  await expect(page.locator('.rqContextQuestion')).toContainText('spreading fire');

  // Skip danger question
  await page.getByRole('button', { name: /Continue without answering/i }).click();
  await expect(page.getByRole('heading', { name: 'Where is the emergency?' })).toBeVisible();

  // Responsive viewports
  for (const width of [320, 360, 375, 390, 430, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if ([390, 1440].includes(width)) {
      await page.screenshot({ path: `test-results/sos-wizard-${width}.png`, fullPage: true });
    }
  }

  // Reduced motion check
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const card = page.locator('.rqStepPane');
  expect(await card.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
});

test('minimal and danger reports preserve the existing payload and successful response flow', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 24.9065, longitude: 67.1608 });

  const payloads: Record<string, unknown>[] = [];
  await page.route('http://localhost:4000/api/incidents', async (route) => {
    payloads.push(route.request().postDataJSON());
    await route.fulfill({ json: { success: true, data: { _id: '661200000000000000000099', reportReference: 'RESQ-000099' } } });
  });

  for (const danger of [false, true]) {
    await page.goto('/sos');
    await page.getByRole('button', { name: 'SOS', exact: true }).click();
    await page.getByRole('button', { name: 'Flood', exact: true }).click();

    // Danger step
    if (danger) {
      await page.getByRole('radio', { name: 'Yes, immediate danger', exact: true }).click();
    } else {
      await page.getByRole('button', { name: /Continue without answering/i }).click();
    }

    // Location step
    await expect(page.getByRole('heading', { name: 'Where is the emergency?' })).toBeVisible();
    await page.getByRole('button', { name: 'Share My Location', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Location captured' })).toBeVisible();

    // Auto-advances to Step 4
    await expect(page.getByRole('heading', { name: 'Review & Send SOS' })).toBeVisible();
    await page.getByRole('button', { name: 'Send SOS Report', exact: true }).click();

    // Confirmation screen
    await expect(page.getByRole('heading', { name: 'SOS Report Submitted', exact: true })).toBeVisible();
    await expect(page.getByText('RESQ-000099')).toBeVisible();

    expect(payloads.at(-1)).toMatchObject({
      emergencyType: 'FLOOD',
      safetyAnswer: danger ? 'YES' : 'UNANSWERED',
      location: { latitude: 24.9065, longitude: 67.1608 },
    });
    expect(payloads.at(-1)).not.toHaveProperty('reporterName');
    expect(payloads.at(-1)).not.toHaveProperty('peopleAffected');
  }

  expect(payloads).toHaveLength(2);
});
