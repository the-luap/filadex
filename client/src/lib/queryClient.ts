import { QueryClient, QueryFunction } from "@tanstack/react-query";

// The server refuses every route but change-password to an account whose
// password must still be changed, and says so with this code. Send the user
// there rather than surface a wall of failed requests.
export function redirectIfPasswordChangeRequired(status: number, body: unknown): void {
  if (status !== 403 || typeof body !== "object" || body === null) return;
  if ((body as { code?: string }).code !== "PASSWORD_CHANGE_REQUIRED") return;
  if (typeof window !== "undefined" && window.location.pathname !== "/change-password") {
    window.location.assign("/change-password");
  }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    try {
      const textResponse = await res.text();
      // Try to parse the response as JSON
      try {
        const jsonData = JSON.parse(textResponse);
        redirectIfPasswordChangeRequired(res.status, jsonData);
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

export async function apiRequest<T = any>(
  url: string,
  options?: RequestInit
): Promise<T> {
  try {
    const isAuthEndpoint = url.includes('/api/auth/');

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

    // No response body to parse (e.g. DELETE endpoints returning 204 No Content)
    if (res.status === 204) {
      return undefined as T;
    }

    return await res.json();
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
      return await res.json();
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
