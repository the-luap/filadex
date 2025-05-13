import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    try {
      const textResponse = await res.text();
      // Versuche, die Antwort als JSON zu parsen
      try {
        const jsonData = JSON.parse(textResponse);
        // Wenn 'message' oder 'detail' vorhanden ist, gib es zurück
        if (jsonData.message || jsonData.detail) {
          throw jsonData;
        }
      } catch (parseError) {
        // Wenn kein gültiges JSON, verwende den Text
      }
      throw new Error(`${res.status}: ${textResponse || res.statusText}`);
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      } else {
        throw error; // Wenn es bereits ein JSON-Objekt ist
      }
    }
  }
}

export async function apiRequest<T = any>(
  url: string,
  options?: RequestInit
): Promise<T> {
  try {
    console.log(`Making API request to: ${url}`, options);
    const res = await fetch(url, {
      ...options,
      headers: {
        ...options?.headers,
        "Content-Type": "application/json"
      },
      credentials: "include",
    });

    await throwIfResNotOk(res);
    const data = await res.json();
    console.log(`API response from ${url}:`, data);
    return data;
  } catch (error) {
    console.error(`API request to ${url} failed:`, error);
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
      console.log(`Making query to: ${queryKey[0]}`);
      const res = await fetch(queryKey[0] as string, {
        credentials: "include",
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      await throwIfResNotOk(res);
      const data = await res.json();
      console.log(`Query response from ${queryKey[0]}:`, data);
      return data;
    } catch (error) {
      console.error(`Query to ${queryKey[0]} failed:`, error);
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
