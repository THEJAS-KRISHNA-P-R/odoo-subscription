/**
 * API client for the Brightloop backend
 * All endpoints return JSON with consistent error shape:
 * {"error":"validation_failed","fields":{"email":"Enter a valid email"}}
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api/v1";

async function request(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  // Check for auth/authorization errors
  if (response.status === 401) {
    // Token expired or not authenticated
    // Could redirect to login
    const errorData = await response.json();
    throw new Error(errorData.error || "Unauthorized");
  }

  if (response.status === 403) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Forbidden");
  }

  return response;
}

/** Generic CRUD helpers */

export interface ListResponse<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  status?: string;
  customer?: string;
  q?: string;
  from?: string;
  to?: string;
  overdue?: boolean;
}

export async function listInvoices(params: PaginationParams = {}): Promise<ListResponse<any>> {
  const paramsString = new URLSearchParams({
    page: (params.page || 1).toString(),
    limit: (params.limit || 100).toString(),
    status: params.status || "",
    customer: params.customer || "",
    q: params.q || "",
    from: params.from || "",
    to: params.to || "",
    overdue: params.overdue ? "1" : "0",
  }).toString();

  const response = await request(`/invoices?${paramsString}`);
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || "Failed to load invoices");
  }
  return response.json();
}

export async function listSubscriptions(params: PaginationParams = {}): Promise<ListResponse<any>> {
  const paramsString = new URLSearchParams({
    page: (params.page || 1).toString(),
    limit: (params.limit || 100).toString(),
    status: params.status || "",
    customer: params.customer || "",
    q: params.q || "",
  }).toString();

  const response = await request(`/subscriptions?${paramsString}`);
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || "Failed to load subscriptions");
  }
  return response.json();
}

export async function createSubscription(data: any): Promise<any> {
  const response = await request("/subscriptions", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || "Failed to create subscription");
  }
  return response.json();
}

export async function updateSubscription(id: number, data: any): Promise<any> {
  const response = await request(`/subscriptions/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || "Failed to update subscription");
  }
  return response.json();
}

export async function runBilling(asOf?: string, dryRun = false): Promise<any> {
  const response = await request("/billing/run", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ asOf, dryRun }),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || "Failed to run billing");
  }
  return response.json();
}

export async function authenticate(email: string, password: string): Promise<{ token: string; user: any }> {
  const response = await request("/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || "Login failed");
  }
  return response.json();
}

export async function signup(data: { email: string; password: string; fullName: string }): Promise<{ user: any; customer: any }> {
  const response = await request("/auth/signup", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || "Signup failed");
  }
  return response.json();
}

// Money formatting helper
export function formatMoney(amountMinor: number, currency: string = "INR"): string {
  if (amountMinor === 0 || amountMinor === null || amountMinor === undefined) {
    return "0.00";
  }
  const amountINR = amountMinor / 100; // Convert minor units to main units
  return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(amountINR);
}