import { test, expect } from '@playwright/test';

const TEST_META_RESPONSE = {
  enums: {
    subscription_status: [
      { value: 'draft', label: 'Draft' },
      { value: 'quotation', label: 'Quotation' },
      { value: 'confirmed', label: 'Confirmed' },
      { value: 'active', label: 'Active' },
      { value: 'paused', label: 'Paused' },
      { value: 'closed', label: 'Closed' },
    ],
    invoice_status: [
      { value: 'draft', label: 'Draft' },
      { value: 'confirmed', label: 'Confirmed' },
      { value: 'paid', label: 'Paid' },
      { value: 'cancelled', label: 'Cancelled' },
    ],
    billing_period: [
      { value: 'monthly', label: 'Monthly' },
      { value: 'yearly', label: 'Yearly' },
    ],
    payment_method: [
      { value: 'upi', label: 'UPI' },
      { value: 'bank_transfer', label: 'Bank Transfer' },
    ],
    product_type: [{ value: 'service', label: 'Service' }],
    discount_kind: [
      { value: 'percentage', label: 'Percentage' },
      { value: 'fixed', label: 'Fixed Amount' },
    ],
    discount_scope: [{ value: 'subscription', label: 'Subscription' }],
  },
  subscription_transitions: {
    draft: ['quotation', 'confirmed'],
    quotation: ['confirmed', 'closed'],
    confirmed: ['active', 'closed'],
    active: ['paused', 'closed'],
    paused: ['active', 'closed'],
    closed: [],
  },
  me: {
    id: 1,
    name: 'Aarav Sharma',
    email: 'aarav@brightloop.in',
    role: 'admin',
    capabilities: [
      'catalog.write',
      'discount.write',
      'subscription.write',
      'billing.run',
      'payment.record',
      'staff.write',
    ],
  },
};

test.describe('Brightloop Subscription Management E2E Suite', () => {
  test('1. Zero-mock policy: displays explicit server error state and retry button when API is unreachable', async ({
    page,
  }) => {
    await page.goto('/invoices');
    await expect(page.getByRole('heading', { name: 'Invoices' })).toBeVisible();
    const alertBox = page.getByRole('alert');
    await expect(alertBox).toBeVisible();
    await expect(alertBox).toContainText('Could not load data from server');
    await expect(alertBox.getByRole('button', { name: 'Retry' })).toBeVisible();
  });

  test('2. Inline header quick-search bar (Ctrl+K) opens extending dropdown and navigates without modal', async ({
    page,
  }) => {
    await page.goto('/home');

    const searchInput = page.getByRole('combobox', {
      name: /Quick search and navigation \(Ctrl\+K\)/i,
    });
    await expect(searchInput).toBeVisible();
    await expect(page.locator('header kbd', { hasText: 'Ctrl+K' })).toBeVisible();

    // Press Control+k to focus the inline search bar and open the extending dropdown
    await page.keyboard.press('Control+k');
    const dropdown = page.locator('#header-search-dropdown');
    await expect(dropdown).toBeVisible();

    // Filter destinations by typing "Settings" and press Enter
    await searchInput.fill('Settings');
    await expect(dropdown.getByRole('option', { name: /Settings/i })).toBeVisible();
    await searchInput.press('Enter');

    await expect(page).toHaveURL(/\/settings$/);
    await expect(dropdown).toBeHidden();
  });

  test('3. Light, Dark (Wise forest-carbon), and System theme switching works in real time', async ({
    page,
  }) => {
    await page.goto('/settings');

    // Select Dark theme
    await page.getByRole('radio', { name: /Dark/i }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(12, 15, 13)');

    // Select Light theme — untouched original Wise light palette (#FFFFFF)
    await page.getByRole('radio', { name: /Light/i }).click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 255, 255)');

    // Select System theme and emulate OS dark / light media queries
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.getByRole('radio', { name: /System/i }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);

    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });

  test('4. Organization & Billing Settings: uploads company logo, updates GSTIN & prefix, and updates live PDF header preview', async ({
    page,
  }) => {
    await page.goto('/settings');

    // Upload a 1x1 transparent PNG via the file input
    const minimalPngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const fileInput = page.locator('#company-logo-upload');
    await fileInput.setInputFiles({
      name: 'brightloop-logo.png',
      mimeType: 'image/png',
      buffer: Buffer.from(minimalPngBase64, 'base64'),
    });

    await expect(page.getByAltText('Uploaded company logo')).toBeVisible();
    await expect(page.getByAltText('Invoice preview logo')).toBeVisible();

    // Update Legal business name, GSTIN, and Invoice prefix
    await page.getByLabel('Legal business name').fill('Brightloop Cloud India');
    await page.getByLabel('Tax Registration / GSTIN').fill('29AABCB1234F1Z5');
    await page.getByLabel('Invoice number prefix').fill('BL-');

    await page.getByRole('button', { name: 'Save settings' }).click();

    // Verify Live PDF Invoice Header Preview and sidebar brand reflect updated values
    await expect(page.getByText('GSTIN: 29AABCB1234F1Z5')).toBeVisible();
    await expect(page.getByText('BL-00042')).toBeVisible();
    await expect(page.locator('aside').first()).toContainText('Brightloop Cloud India');
  });

  test('5. Invoices list: Export CSV passes active filter parameters to /invoices?format=csv and drawer renders PDF Tax Invoice preview', async ({
    page,
  }) => {
    const requestedUrls: string[] = [];

    await page.route('**/api/v1/meta', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(TEST_META_RESPONSE),
      });
    });

    await page.route(/\/api\/v1\/invoices/, async (route) => {
      const url = route.request().url();
      requestedUrls.push(url);

      if (url.includes('format=csv')) {
        await route.fulfill({
          status: 200,
          contentType: 'text/csv',
          body: 'number,customer_name,status,total_minor\nINV-2026-009,Kaveri Retail,confirmed,295000\n',
        });
        return;
      }

      if (url.includes('/invoices/109')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 109,
            number: 'INV-2026-009',
            subscription_id: 55,
            subscription_number: 'SUB-0055',
            customer_id: 12,
            customer_name: 'Kaveri Retail Pvt Ltd',
            status: 'confirmed',
            is_overdue: true,
            issue_date: '2026-10-01',
            due_date: '2026-10-15',
            period_start: '2026-10-01',
            period_end: '2026-10-31',
            subtotal_minor: 250000,
            discount_minor: 0,
            tax_minor: 45000,
            total_minor: 295000,
            paid_minor: 0,
            outstanding_minor: 295000,
            lines: [
              {
                description: 'Brightloop Enterprise Suite (Odoo Brand)',
                quantity: 1,
                unit_price_minor: 250000,
                tax_rate_bp: 1800,
                amount_minor: 295000,
              },
            ],
            discounts: [],
            payments: [],
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: 109,
              number: 'INV-2026-009',
              subscription_id: 55,
              subscription_number: 'SUB-0055',
              customer_id: 12,
              customer_name: 'Kaveri Retail Pvt Ltd',
              status: 'confirmed',
              is_overdue: true,
              issue_date: '2026-10-01',
              due_date: '2026-10-15',
              period_start: '2026-10-01',
              period_end: '2026-10-31',
              subtotal_minor: 250000,
              discount_minor: 0,
              tax_minor: 45000,
              total_minor: 295000,
              paid_minor: 0,
              outstanding_minor: 295000,
            },
          ],
          next_cursor: null,
        }),
      });
    });

    await page.goto('/invoices');
    await expect(page.getByText('INV-2026-009')).toBeVisible();
    await expect(page.getByText('₹2,950.00').first()).toBeVisible();

    // Activate Overdue filter pill button and search input
    await page.getByRole('button', { name: 'Overdue', exact: true }).click();
    await page.getByPlaceholder(/Search by invoice number/i).fill('INV-2026');

    // Click Export CSV and verify query parameters sent to /invoices?format=csv
    await page.getByRole('button', { name: /Export CSV/i }).click();
    await expect
      .poll(() => requestedUrls.some((u) => u.includes('format=csv')))
      .toBeTruthy();

    const csvCall = requestedUrls.find((u) => u.includes('format=csv'))!;
    expect(csvCall).toContain('format=csv');
    expect(csvCall).toContain('overdue=true');
    expect(csvCall).toContain('q=INV-2026');

    // Open Invoice Drawer and switch to PDF Tax Invoice preview
    await page.getByRole('button', { name: 'Open invoice INV-2026-009' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Download PDF/i })).toBeVisible();

    await dialog.getByRole('button', { name: /PDF Tax Invoice/i }).click();
    await expect(dialog.getByText('Tax Invoice', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Brightloop Enterprise Suite (Odoo Brand)')).toBeVisible();
  });

  test('6. Customer signup password checklist and Catalog sub-navigation work end-to-end', async ({
    page,
  }) => {
    await page.goto('/signup');
    const pwdInput = page.getByPlaceholder('Create a strong password');
    await pwdInput.fill('short');
    await expect(page.getByText('More than 8 characters')).toBeVisible();

    await pwdInput.fill('StrongPass#2026');
    // Navigate to Catalog Products and switch tabs via CatalogSubnav
    await page.goto('/catalog/products');
    const subnav = page.getByRole('navigation', { name: 'Catalog sections' });
    await expect(subnav).toBeVisible();
    await subnav.getByRole('link', { name: /Billing Plans/i }).click();
    await expect(page).toHaveURL(/\/catalog\/plans$/);
    await expect(page.getByRole('heading', { name: 'Plans' })).toBeVisible();
  });
});
