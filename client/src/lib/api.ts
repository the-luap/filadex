/**
 * API request utility function
 */

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  skipAuth?: boolean;
  // If true, don't log errors for this request (useful for auth endpoints)
  silent?: boolean;
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
  const isAuthEndpoint = endpoint.includes('/api/auth/');
  const isPublicEndpoint = endpoint.includes('/api/public/');
  const silent = options.silent || isAuthEndpoint || isPublicEndpoint;

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

  try {
    // Add extra debugging for batch endpoints
    const isBatchEndpoint = endpoint.includes('/api/filaments/batch');
    if (isBatchEndpoint) {
      console.log(`DEBUG: Making batch request to ${endpoint} with:`, {
        method,
        headers,
        body: body ? JSON.parse(JSON.stringify(body)) : null
      });
    }

    const response = await fetch(endpoint, requestOptions);

    // Add extra debugging for batch endpoints
    if (isBatchEndpoint) {
      console.log(`DEBUG: Batch response status:`, response.status);
      console.log(`DEBUG: Batch response headers:`, {
        'content-type': response.headers.get('content-type'),
        'set-cookie': response.headers.get('set-cookie')
      });

      // Clone the response to read the body for debugging
      const clonedRes = response.clone();
      try {
        const textResponse = await clonedRes.text();
        console.log(`DEBUG: Batch response body:`, textResponse);
      } catch (err) {
        console.error(`DEBUG: Error reading response body:`, err);
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      // Special handling for 401 errors on auth endpoints or public endpoints
      if (response.status === 401 && (isAuthEndpoint || isPublicEndpoint)) {
        // For /api/auth/me or public endpoints, we expect 401 when not logged in, so handle silently
        if (endpoint === '/api/auth/me' || isPublicEndpoint) {
          const error: any = new Error('Not authenticated');
          error.status = 401;
          error.silent = true;
          throw error;
        }
      }

      // Add extra debugging for batch endpoints
      if (isBatchEndpoint) {
        console.error(`DEBUG: Batch request error:`, {
          status: response.status,
          errorData
        });
      }

      const error: any = new Error(
        errorData.message || `API request failed with status ${response.status}`
      );
      error.status = response.status;
      error.response = { data: errorData };
      error.silent = silent;
      throw error;
    }

    // For 204 No Content responses
    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  } catch (error: any) {
    // Add extra debugging for batch endpoints
    const isBatchEndpoint = endpoint.includes('/api/filaments/batch');
    if (isBatchEndpoint) {
      console.error(`DEBUG: Caught error in batch request to ${endpoint}:`, {
        message: error.message,
        status: error.status,
        response: error.response,
        stack: error.stack
      });
    }

    // Only log errors if not silent and not a 401 on auth endpoint or public endpoint
    if (!error.silent && !(error.status === 401 && (isAuthEndpoint || isPublicEndpoint))) {
      console.error(`API request to ${endpoint} failed:`, error);
    }
    throw error;
  }
}
