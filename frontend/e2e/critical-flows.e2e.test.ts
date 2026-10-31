import { test, expect } from '@playwright/test';

const SHARED_META = {
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

test.describe('Critical User Flows E2E Suite', () => {
  test('Flow 1: Sign-up flow — customer registration with security validation and onboarding', async ({
    page,
  }) => {
    let signupPayload: unknown = null;

    await page.route('**/api/v1/meta', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(SHARED_META),
      });
    });

    await page.route('**/api/v1/auth/signup', async (route) => {
      signupPayload = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          role: 'customer',
          message: 'Account created successfully',
        }),
      });
    });

    await page.route('**/api/v1/me/subscriptions*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], next_cursor: null }),
      });
    });

    await page.route('**/api/v1/me/invoices*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], next_cursor: null }),
      });
    });

    await page.goto('/signup');

    // Verify header and form elements
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();

    const nameInput = page.getByLabel('Full name');
    const emailInput = page.getByLabel('Email address');
    const passwordInput = page.getByPlaceholder('Create a strong password');

    // Test real-time security rules checklist with weak password
    await passwordInput.fill('weak');
    await expect(page.getByText('More than 8 characters')).toBeVisible();

    // Fill valid registration fields
    await nameInput.fill('Priya Sen');
    await emailInput.fill('priya@zenithcorp.in');
    await passwordInput.fill('Zenith#Pass2026');

    // Submit sign up
    await page.getByRole('button', { name: 'Sign up' }).click();

    // Verify API received valid payload
    await expect.poll(() => signupPayload).toBeTruthy();
    expect(signupPayload).toEqual({
      full_name: 'Priya Sen',
      email: 'priya@zenithcorp.in',
      password: 'Zenith#Pass2026',
    });

    // Verify redirected to customer portal and success toast appears
    await expect(page).toHaveURL(/\/portal\/home$/);
    await expect(page.getByText('Account created')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Welcome to your billing portal/i })).toBeVisible();
  });

  test('Flow 2: Creating a plan flow — creates new recurring catalog plan with cadence and pricing', async ({
    page,
  }) => {
    let createdPayload: Record<string, unknown> | null = null;
    const plansList: Array<Record<string, unknown>> = [
      {
        id: 1,
        name: 'Starter Monthly',
        price_minor: 99900,
        billing_period: 'monthly',
        min_quantity: 1,
        auto_close: false,
        closable: true,
        pausable: true,
        renewable: true,
        is_active: true,
      },
    ];

    await page.route('**/api/v1/meta', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(SHARED_META),
      });
    });

    await page.route('**/api/v1/plans*', async (route) => {
      const method = route.request().method();
      if (method === 'POST') {
        createdPayload = route.request().postDataJSON() as Record<string, unknown>;
        const newPlan = {
          id: 2,
          ...createdPayload,
        };
        plansList.push(newPlan);
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(newPlan),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: plansList, next_cursor: null }),
      });
    });

    await page.goto('/catalog/plans');

    await expect(page.getByRole('heading', { name: 'Plans' })).toBeVisible();
    await expect(page.getByText('Starter Monthly')).toBeVisible();

    // Click "New plan" button to open the Drawer
    await page.getByRole('button', { name: 'New plan' }).click();

    const drawer = page.getByRole('dialog');
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText('New plan', { exact: true })).toBeVisible();

    // Fill plan setup inputs
    await drawer.getByLabel('Plan name').fill('Growth Annual Pro');
    await drawer.getByLabel(/Base price/i).fill('4999.00');
    await drawer.getByLabel('Billing period').selectOption('yearly');
    await drawer.getByLabel(/Minimum quantity/i).fill('5');

    // Click Create plan
    await drawer.getByRole('button', { name: 'Create plan' }).click();

    // Verify POST payload sent to /api/v1/plans
    await expect.poll(() => createdPayload).toBeTruthy();
    expect(createdPayload).toMatchObject({
      name: 'Growth Annual Pro',
      price_minor: 499900,
      billing_period: 'yearly',
      min_quantity: 5,
      renewable: true,
      is_active: true,
    });

    // Verify drawer closed, toast shown, and newly created plan rendered in list
    await expect(drawer).toBeHidden();
    await expect(page.getByText('Plan created')).toBeVisible();
    await expect(page.getByText('Growth Annual Pro')).toBeVisible();
    await expect(page.getByText('₹4,999.00')).toBeVisible();
    await expect(page.getByText(/Yearly/i).first()).toBeVisible();
  });

  test('Flow 3: Converting a template to a subscription — instantiates quote template for customer', async ({
    page,
  }) => {
    let instantiatePayload: Record<string, unknown> | null = null;

    await page.route('**/api/v1/meta', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(SHARED_META),
      });
    });

    await page.route(/\/api\/v1\/templates/, async (route) => {
      const url = route.request().url();
      if (url.includes('/instantiate')) {
        instantiatePayload = route.request().postDataJSON() as Record<string, unknown>;
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 88,
            number: 'SUB-0088',
            customer_id: 12,
            customer_name: 'Kaveri Retail Pvt Ltd',
            plan_id: 1,
            plan_name: 'Enterprise Cloud Pack',
            status: 'draft',
            start_date: '2026-11-01',
            expiry_date: '2026-11-30',
            currency: 'INR',
            subtotal_minor: 500000,
            discount_minor: 0,
            tax_minor: 90000,
            total_minor: 590000,
            lines: [
              {
                id: 1,
                product_id: 10,
                product_name: 'Enterprise Core License',
                quantity: 2,
                unit_price_minor: 250000,
                tax_rate_bp: 1800,
                amount_minor: 590000,
              },
            ],
            discounts: [],
            invoices: [],
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
              id: 12,
              name: 'Enterprise Cloud Pack',
              plan_id: 1,
              plan_name: 'Enterprise Cloud Pack',
              validity_days: 30,
              lines: [
                {
                  product_id: 10,
                  product_name: 'Enterprise Core License',
                  quantity: 2,
                },
              ],
            },
          ],
          next_cursor: null,
        }),
      });
    });

    await page.route('**/api/v1/customers*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: 12,
              name: 'Kaveri Retail Pvt Ltd',
              email: 'billing@kaveri.in',
            },
          ],
          next_cursor: null,
        }),
      });
    });

    await page.route('**/api/v1/plans*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], next_cursor: null }),
      });
    });

    await page.route('**/api/v1/products*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], next_cursor: null }),
      });
    });

    await page.route('**/api/v1/subscriptions/88', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 88,
          number: 'SUB-0088',
          customer_id: 12,
          customer_name: 'Kaveri Retail Pvt Ltd',
          plan_id: 1,
          plan_name: 'Enterprise Cloud Pack',
          status: 'draft',
          start_date: '2026-11-01',
          expiry_date: '2026-11-30',
          currency: 'INR',
          subtotal_minor: 500000,
          discount_minor: 0,
          tax_minor: 90000,
          total_minor: 590000,
          lines: [
            {
              id: 1,
              product_id: 10,
              product_name: 'Enterprise Core License',
              quantity: 2,
              unit_price_minor: 250000,
              tax_rate_bp: 1800,
              amount_minor: 590000,
            },
          ],
          discounts: [],
          invoices: [],
        }),
      });
    });

    await page.goto('/catalog/templates');

    await expect(page.getByRole('heading', { name: 'Templates' })).toBeVisible();
    await expect(page.getByText('Enterprise Cloud Pack').first()).toBeVisible();

    // Click "Instantiate" button on the template row
    await page.getByRole('button', { name: 'Instantiate', exact: true }).click();

    // Modal opens to select customer
    const instantiateModal = page.getByRole('dialog');
    await expect(instantiateModal).toBeVisible();
    await expect(instantiateModal.getByText(/Instantiate "Enterprise Cloud Pack"/i)).toBeVisible();

    // Wait for customer options to load from API before selecting
    const customerOption = instantiateModal.locator('option', { hasText: 'Kaveri Retail Pvt Ltd' });
    await expect(customerOption).toBeAttached();
    await instantiateModal.getByLabel('Customer').selectOption('12');
    await expect(instantiateModal.getByLabel('Customer')).toHaveValue('12');
    await instantiateModal.getByRole('button', { name: 'Create draft subscription' }).click();

    // Verify instantiate POST request payload
    await expect.poll(() => instantiatePayload).toBeTruthy();
    expect(instantiatePayload).toEqual({ customer_id: '12' });

    // Verify toast notification for created draft subscription
    await expect(page.getByText('Draft subscription SUB-0088 created')).toBeVisible();

    // Verify SubscriptionDrawer opens with the created subscription in Draft status
    const subDrawer = page.getByRole('dialog');
    await expect(subDrawer).toBeVisible();
    await expect(subDrawer.getByText('Subscription SUB-0088')).toBeVisible();
    await expect(subDrawer.getByText('Draft').first()).toBeVisible();
    await expect(subDrawer.getByText('Kaveri Retail Pvt Ltd')).toBeVisible();
  });

  test('Flow 4: Processing an invoice payment — records payment, verifies Idempotency-Key, and settles invoice', async ({
    page,
  }) => {
    let paymentPayload: Record<string, unknown> | null = null;
    let paymentIdempotencyKey: string | null = null;

    let invoiceState: Record<string, unknown> = {
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
          description: 'Brightloop Enterprise Cloud',
          quantity: 1,
          unit_price_minor: 250000,
          tax_rate_bp: 1800,
          amount_minor: 295000,
        },
      ],
      discounts: [],
      payments: [],
    };

    await page.route('**/api/v1/meta', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(SHARED_META),
      });
    });

    await page.route(/\/api\/v1\/invoices/, async (route) => {
      const url = route.request().url();
      const method = route.request().method();

      if (url.includes('/payments') && method === 'POST') {
        paymentPayload = route.request().postDataJSON() as Record<string, unknown>;
        paymentIdempotencyKey = route.request().headers()['idempotency-key'] || null;

        // Update invoice state to Paid
        invoiceState = {
          ...invoiceState,
          status: 'paid',
          is_overdue: false,
          paid_minor: 295000,
          outstanding_minor: 0,
          payments: [
            {
              id: 1,
              invoice_id: 109,
              method: 'upi',
              amount_minor: 295000,
              paid_on: '2026-10-31',
              note: 'Cleared via UPI reference #984210',
            },
          ],
        };

        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ id: 1, invoice_id: 109, status: 'paid' }),
        });
        return;
      }

      if (url.includes('/invoices/109')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(invoiceState),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [invoiceState],
          next_cursor: null,
        }),
      });
    });

    await page.goto('/invoices');

    // List renders confirmed invoice with outstanding amount
    await expect(page.getByRole('heading', { name: 'Invoices' })).toBeVisible();
    await expect(page.getByText('INV-2026-009')).toBeVisible();
    await expect(page.getByText('₹2,950.00').first()).toBeVisible();
    await expect(page.getByText('₹2,950.00 due')).toBeVisible();

    // Click on invoice to open InvoiceDrawer
    await page.getByRole('button', { name: 'Open invoice INV-2026-009' }).click();

    const invoiceDrawer = page.getByRole('dialog');
    await expect(invoiceDrawer).toBeVisible();
    await expect(invoiceDrawer.getByText('Invoice INV-2026-009')).toBeVisible();
    await expect(invoiceDrawer.getByText('Confirmed').first()).toBeVisible();

    // Click Record Payment button inside the drawer
    await invoiceDrawer.getByRole('button', { name: 'Record payment' }).click();

    // Record Payment Modal opens
    const paymentModal = page.getByRole('dialog').filter({ hasText: 'Recording payment against invoice' });
    await expect(paymentModal).toBeVisible();

    // Verify prefilled outstanding amount
    const amountInput = paymentModal.getByLabel(/Amount/i);
    await expect(amountInput).toHaveValue('2950');

    // Fill Payment Method and Note
    await paymentModal.getByLabel(/Payment method/i).selectOption('upi');
    await paymentModal.getByLabel(/Note/i).fill('Cleared via UPI reference #984210');

    // Submit payment
    await paymentModal.getByRole('button', { name: 'Record payment' }).click();

    // Verify Idempotency-Key header and payload
    await expect.poll(() => paymentPayload).toBeTruthy();
    expect(paymentIdempotencyKey).toBeTruthy();
    expect(paymentPayload).toMatchObject({
      method: 'upi',
      amount_minor: 295000,
      note: 'Cleared via UPI reference #984210',
    });

    // Verify modal closes, toast appears, and invoice status updates to Paid with 0 outstanding
    await expect(paymentModal).toBeHidden();
    await expect(page.getByText('Payment recorded')).toBeVisible();
    await expect(invoiceDrawer.getByText('Paid', { exact: true }).first()).toBeVisible();
  });
});
