export class ApiError extends Error {
  public status: number;
  public code: string;
  public details?: unknown;
  public requestId?: string;

  constructor(status: number, data: unknown) {
    const errorData = data as {
      error?: { message?: string; code?: string; details?: unknown; request_id?: string };
    };
    super(errorData?.error?.message || 'API request failed');
    this.name = 'ApiError';
    this.status = status;
    this.code = errorData?.error?.code || 'UNKNOWN_ERROR';
    this.details = errorData?.error?.details;
    this.requestId = errorData?.error?.request_id;
  }
}

export async function apiClient<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const isBrowser = typeof window !== 'undefined';
  let baseUrl = '';

  if (!isBrowser) {
    const { headers } = await import('next/headers');
    const headersList = await headers();
    const host = headersList.get('host');
    const protocol =
      headersList.get('x-forwarded-proto') || (host?.includes('localhost') ? 'http' : 'https');

    const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;

    baseUrl =
      process.env.APP_BASE_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      (host
        ? `${protocol}://${host}`
        : vercelUrl
          ? `https://${vercelUrl}`
          : 'http://localhost:3000');
  }

  const url = `${baseUrl}/api${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  let token: string | undefined;
  if (!isBrowser) {
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    token = cookieStore.get('recheq_session')?.value;
  }

  const headersObj: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };

  if (!(options.body instanceof FormData)) {
    headersObj['Content-Type'] = headersObj['Content-Type'] || 'application/json';
  }

  const response = await fetch(url, {
    ...options,
    headers: headersObj,
  });

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      errorData = { error: { message: response.statusText } };
    }
    throw new ApiError(response.status, errorData);
  }

  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return {} as T;
  }

  return response.json();
}
