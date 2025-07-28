import { QueryClient } from "@tanstack/react-query";

// Custom fetch function that includes credentials for cookie-based auth
async function fetchWithCredentials(url: string, config?: RequestInit) {
  const response = await fetch(url, {
    ...config,
    credentials: 'include', // Include cookies for authentication
    headers: {
      'Content-Type': 'application/json',
      ...config?.headers,
    },
  });

  if (!response.ok) {
    const error = new Error(`${response.status}: ${response.statusText}`);
    throw error;
  }

  return response.json();
}

// API request helper for mutations
export async function apiRequest(url: string, options: RequestInit = {}) {
  return fetchWithCredentials(url, options);
}

// Create query client with custom default query function
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: ({ queryKey }) => {
        const url = queryKey[0] as string;
        return fetchWithCredentials(url);
      },
      retry: (failureCount, error: any) => {
        // Don't retry on authentication errors
        if (error?.message?.includes('401')) {
          return false;
        }
        return failureCount < 3;
      },
    },
  },
});