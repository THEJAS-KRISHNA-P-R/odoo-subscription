/**
 * API client for the Brightloop backend.
 * All endpoints return JSON with a consistent error shape:
 * {"error":"validation_failed","fields":{"email":"Enter a valid email"}}
 */

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api/v1";

/** Arbitrary JSON object returned by the backend. */
export type ApiRecord = Record<string, unknown>;

interface ErrorBody {
  error?: string;
  message?: string;
  fields?: Record<string, string>;
}

/** Read the error payload from a failed response without throwing. */
async function errorFrom(response: Response, fallback: string): Promise<Error> {
  let body: ErrorBody | null = null;
  try {
    body = (await response.json()) as ErrorBody;
  } catch {
    body = null;
  }
  return new Error(body?.message || body?.error || fallback);
}

async function request(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (response.status === 401 || response.status === 403) {
    throw await errorFrom(
      response,
      response.status === 401 ? "Unauthorized" : "Forbidden",
    );
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

export async function listInvoices(
  params: PaginationParams = {},
): Promise<ListResponse<ApiRecord>> {
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
    throw await errorFrom(response, "Failed to load invoices");
  }
  return response.json() as Promise<ListResponse<ApiRecord>>;
}

export async function listSubscriptions(
  params: PaginationParams = {},
): Promise<ListResponse<ApiRecord>> {
  const paramsString = new URLSearchParams({
    page: (params.page || 1).toString(),
    limit: (params.limit || 100).toString(),
    status: params.status || "",
    customer: params.customer || "",
    q: params.q || "",
  }).toString();

  const response = await request(`/subscriptions?${paramsString}`);
  if (!response.ok) {
    throw await errorFrom(response, "Failed to load subscriptions");
  }
  return response.json() as Promise<ListResponse<ApiRecord>>;
}

export async function createSubscription(data: ApiRecord): Promise<ApiRecord> {
  const response = await request("/subscriptions", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw await errorFrom(response, "Failed to create subscription");
  }
  return response.json() as Promise<ApiRecord>;
}

export async function updateSubscription(
  id: number,
  data: ApiRecord,
): Promise<ApiRecord> {
  const response = await request(`/subscriptions/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw await errorFrom(response, "Failed to update subscription");
  }
  return response.json() as Promise<ApiRecord>;
}

export async function runBilling(
  asOf?: string,
  dryRun = false,
): Promise<ApiRecord> {
  const response = await request("/billing/run", {
    method: "POST",
    body: JSON.stringify({ asOf, dryRun }),
  });
  if (!response.ok) {
    throw await errorFrom(response, "Failed to run billing");
  }
  return response.json() as Promise<ApiRecord>;
}

export interface AuthResponse {
  token: string;
  user: ApiRecord;
}

export async function authenticate(
  email: string,
  password: string,
): Promise<AuthResponse> {
  const response = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    throw await errorFrom(response, "Login failed");
  }
  return response.json() as Promise<AuthResponse>;
}

export interface SignupResponse {
  user: ApiRecord;
  customer: ApiRecord;
}

export async function signup(data: {
  email: string;
  password: string;
  fullName: string;
}): Promise<SignupResponse> {
  const response = await request("/auth/signup", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw await errorFrom(response, "Signup failed");
  }
  return response.json() as Promise<SignupResponse>;
}
