import { test, expect } from '@playwright/test';

test.describe('RESQLINK — 4-Step Animated Emergency Reporting Wizard', () => {
  test('progresses smoothly through all 4 steps: Emergency -> Danger -> Location -> Review & Submit', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 25.396, longitude: 68.3578 });

    const submittedPayloads: Record<string, unknown>[] = [];
    await page.route('http://localhost:4000/api/incidents', async (route) => {
      submittedPayloads.push(route.request().postDataJSON());
      await route.fulfill({
        status: 201,
        json: {
          success: true,
          data: {
            _id: '671234567890abcdef123456',
            reportReference: 'RESQ-000123',
          },
        },
      });
    });

    await page.goto('/sos');

    // 1. Initial screen
    await expect(page.getByRole('heading', { name: 'Need Emergency Help?', level: 1 })).toBeVisible();
    await page.getByRole('button', { name: 'SOS', exact: true }).click();

    // 2. Step 1: Emergency Type
    await expect(page.getByRole('heading', { name: 'What happened?' })).toBeVisible();
    const progressNav = page.getByRole('navigation', { name: 'Reporting progress' });
    await expect(progressNav).toBeVisible();
    await expect(progressNav.getByText('Emergency')).toBeVisible();

    // Select Medical Emergency -> auto-advances to Step 2
    await page.getByRole('button', { name: 'Medical Emergency', exact: true }).click();

    // 3. Step 2: Danger Assessment
    await expect(page.getByRole('heading', { name: 'Is anyone in immediate danger?' })).toBeVisible();
    await expect(page.locator('.rqContextQuestion')).toContainText('unconscious, not breathing normally');

    // Select Yes, immediate danger -> auto-advances to Step 3
    await page.getByRole('radio', { name: 'Yes, immediate danger', exact: true }).click();

    // 4. Step 3: Location
    await expect(page.getByRole('heading', { name: 'Where is the emergency?' })).toBeVisible();
    await page.getByRole('button', { name: 'Share My Location', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Location captured' })).toBeVisible();

    // 5. Step 4: Review & Send
    await expect(page.getByRole('heading', { name: 'Review & Send SOS' })).toBeVisible();
    await expect(page.getByText('Medical Emergency')).toBeVisible();
    await expect(page.getByText('Immediate danger reported')).toBeVisible();
    await expect(page.getByText('25.39600, 68.35780')).toBeVisible();

    // Fill optional details
    await page.getByText('Additional Details (Optional)', { exact: false }).click();
    await page.getByLabel('What happened?').fill('Patient experiencing severe breathing difficulty');
    await page.getByLabel('Your name').fill('Fatima');
    await page.getByLabel('People affected').fill('1');

    // Submit SOS Report
    await page.getByRole('button', { name: 'Send SOS Report', exact: true }).click();

    // 6. Confirmation screen
    await expect(page.getByRole('heading', { name: 'SOS Report Submitted' })).toBeVisible();
    await expect(page.getByText('RESQ-000123')).toBeVisible();

    // Verify copy button
    await page.getByRole('button', { name: 'Copy Reference Number' }).click();
    await expect(page.getByRole('button', { name: 'Reference Copied!' })).toBeVisible();

    // Check payload
    expect(submittedPayloads).toHaveLength(1);
    expect(submittedPayloads[0]).toMatchObject({
      emergencyType: 'MEDICAL',
      safetyAnswer: 'YES',
      immediateDanger: true,
      reporterName: 'Fatima',
      peopleAffected: 1,
      description: 'Patient experiencing severe breathing difficulty',
      location: { latitude: 25.396, longitude: 68.3578 },
    });
  });

  test('allows skipping danger question with Continue without answering', async ({ page }) => {
    let submittedData: Record<string, unknown> | null = null;
    await page.route('http://localhost:4000/api/incidents', async (route) => {
      submittedData = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        json: { success: true, data: { _id: '670000000000000000000001', reportReference: 'RESQ-000001' } },
      });
    });

    await page.goto('/sos');
    await page.getByRole('button', { name: 'SOS', exact: true }).click();

    // Step 1: Select Fire
    await page.getByRole('button', { name: 'Fire', exact: true }).click();

    // Step 2: Skip danger
    await expect(page.getByRole('heading', { name: 'Is anyone in immediate danger?' })).toBeVisible();
    await page.getByRole('button', { name: 'Continue without answering' }).click();

    // Step 3: Enter landmark
    await expect(page.getByRole('heading', { name: 'Where is the emergency?' })).toBeVisible();
    await page.getByPlaceholder('Village, district, road, mosque or school').fill('Near Civil Hospital Larkana');
    await page.getByRole('button', { name: 'Continue to Review' }).click();

    // Step 4: Submit
    await expect(page.getByRole('heading', { name: 'Review & Send SOS' })).toBeVisible();
    await expect(page.getByText('Unanswered (Optional)')).toBeVisible();
    await page.getByRole('button', { name: 'Send SOS Report' }).click();

    await expect(page.getByRole('heading', { name: 'SOS Report Submitted' })).toBeVisible();
    expect(submittedData).toMatchObject({
      emergencyType: 'FIRE',
      safetyAnswer: 'UNANSWERED',
    });
  });

  test('back navigation and change links allow modifying previous answers safely', async ({ page }) => {
    await page.goto('/sos');
    await page.getByRole('button', { name: 'SOS', exact: true }).click();

    // Step 1: Select Flood
    await page.getByRole('button', { name: 'Flood', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Is anyone in immediate danger?' })).toBeVisible();

    // Step 2: Click Back -> returns to Step 1
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByRole('heading', { name: 'What happened?' })).toBeVisible();

    // Select Road Accident
    await page.getByRole('button', { name: 'Road Accident' }).click();
    await expect(page.getByRole('heading', { name: 'Is anyone in immediate danger?' })).toBeVisible();
    await expect(page.locator('.rqContextQuestion')).toContainText('trapped in a vehicle');

    // Answer No known immediate danger
    await page.getByRole('radio', { name: 'No known immediate danger' }).click();
    await expect(page.getByRole('heading', { name: 'Where is the emergency?' })).toBeVisible();

    // Enter landmark and continue
    await page.getByPlaceholder('Village, district, road, mosque or school').fill('National Highway N-5 KM 42');
    await page.getByRole('button', { name: 'Continue to Review' }).click();

    // In Step 4: Click Change on Emergency
    await expect(page.getByRole('heading', { name: 'Review & Send SOS' })).toBeVisible();
    const changeButtons = page.getByRole('button', { name: 'Change' });
    await changeButtons.first().click();

    // Returns to Step 1
    await expect(page.getByRole('heading', { name: 'What happened?' })).toBeVisible();
  });
});
