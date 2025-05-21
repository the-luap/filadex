import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    try {
      const textResponse = await res.text();
      // Try to parse the response as JSON
      try {
        const jsonData = JSON.parse(textResponse);
        // If 'message' or 'detail' is present, return it
        if (jsonData.message || jsonData.detail) {
          // Add status code to the error object for better error handling
          jsonData.status = res.status;
          throw jsonData;
        }
      } catch (parseError) {
        // If not valid JSON, use the text
      }
      throw new Error(`${res.status}: ${textResponse || res.statusText}`);
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      } else {
        throw error; // If it's already a JSON object
      }
    }
  }
}

// List of API endpoints that don't require authentication
const PUBLIC_API_ENDPOINTS = [
  '/api/auth/login',
  '/api/auth/logout',
  '/api/public'
];

// Check if an API endpoint is public
function isPublicApiEndpoint(url: string): boolean {
  return PUBLIC_API_ENDPOINTS.some(endpoint =>
    url === endpoint || url.startsWith(endpoint + '/')
  );
}

export async function apiRequest<T = any>(
  url: string,
  options?: RequestInit
): Promise<T> {
  try {
    // Only log API requests for non-authentication endpoints to reduce console noise
    const isAuthEndpoint = url.includes('/api/auth/');
    if (!isAuthEndpoint) {
      console.log(`Making API request to: ${url}`, options);
    }

    const res = await fetch(url, {
      ...options,
      headers: {
        ...options?.headers,
        "Content-Type": "application/json"
      },
      credentials: "include",
    });

    // For 401 errors on authentication endpoints, don't log the error
    if (res.status === 401 && isAuthEndpoint) {
      // Handle 401 silently for auth endpoints
      if (url === '/api/auth/me') {
        throw new Error('Not authenticated');
      }
    }

    await throwIfResNotOk(res);
    const data = await res.json();

    // Only log responses for non-authentication endpoints
    if (!isAuthEndpoint) {
      console.log(`API response from ${url}:`, data);
    }

    return data;
  } catch (error) {
    // Only log errors for non-authentication endpoints or if it's not a 401 error
    const isAuthEndpoint = url.includes('/api/auth/');
    const is401Error = error instanceof Error &&
      (error.message.includes('401') || error.message.includes('Not authenticated'));

    if (!isAuthEndpoint || !is401Error) {
      console.error(`API request to ${url} failed:`, error);
    }

    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    try {
      const url = queryKey[0] as string;
      const isAuthEndpoint = url.includes('/api/auth/');

      // Only log queries for non-authentication endpoints
      if (!isAuthEndpoint) {
        console.log(`Making query to: ${url}`);
      }

      const res = await fetch(url, {
        credentials: "include",
      });

      // Handle 401 errors based on the behavior option
      if (res.status === 401) {
        if (unauthorizedBehavior === "returnNull") {
          return null;
        }

        // For auth endpoints, don't log the error
        if (isAuthEndpoint) {
          throw new Error('Not authenticated');
        }
      }

      await throwIfResNotOk(res);
      const data = await res.json();

      // Only log responses for non-authentication endpoints
      if (!isAuthEndpoint) {
        console.log(`Query response from ${url}:`, data);
      }

      return data;
    } catch (error) {
      const url = queryKey[0] as string;
      const isAuthEndpoint = url.includes('/api/auth/');
      const is401Error = error instanceof Error &&
        (error.message.includes('401') || error.message.includes('Not authenticated'));

      // Only log errors for non-authentication endpoints or if it's not a 401 error
      if (!isAuthEndpoint || !is401Error) {
        console.error(`Query to ${url} failed:`, error);
      }

      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 0, // Setze staleTime auf 0, damit invalidateQueries sofort funktioniert
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
