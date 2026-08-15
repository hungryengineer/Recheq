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
  // Use absolute URL for SSR and Server Actions
  const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
  const url = `${baseUrl}/api${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
  };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }

  const response = await fetch(url, {
    ...options,
    headers,
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
