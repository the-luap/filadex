/**
 * API request utility function
 */

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  skipAuth?: boolean;
};

/**
 * Makes an API request to the specified endpoint
 * @param endpoint The API endpoint to request
 * @param options Request options
 * @returns Promise with the response data
 */
export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = 'GET', headers = {}, body, skipAuth = false } = options;

  const requestOptions: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    // Only include credentials for authenticated requests
    credentials: skipAuth ? 'omit' : 'include',
  };

  if (body) {
    requestOptions.body = JSON.stringify(body);
  }

  const response = await fetch(endpoint, requestOptions);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error: any = new Error(
      errorData.message || `API request failed with status ${response.status}`
    );
    error.status = response.status;
    error.response = { data: errorData };
    throw error;
  }

  // For 204 No Content responses
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}
