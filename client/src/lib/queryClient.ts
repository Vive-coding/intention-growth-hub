import { QueryClient } from "@tanstack/react-query";

// Custom fetch function that includes credentials for cookie-based auth
async function fetchWithCredentials(url: string, config?: RequestInit) {
  const token = localStorage.getItem("token");
  
  // Get the API base URL from environment variable
  const apiBaseUrl = import.meta.env.VITE_API_URL || '';
  
  // If it's a relative URL, prepend the API base URL
  const fullUrl = url.startsWith('/') ? `${apiBaseUrl}${url}` : url;
  
  console.log(`🌐 Making request to ${fullUrl} with token: ${token ? 'present' : 'missing'}`);
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...config?.headers,
  };

  const response = await fetch(fullUrl, {
    ...config,
    credentials: 'include', // Include cookies for authentication
    headers,
  });

  console.log(`🌐 Response from ${url}: ${response.status} ${response.statusText}`);

  if (!response.ok) {
    // Try to get the response body for better error handling
    let errorMessage = `${response.status}: ${response.statusText}`;
    let errorData = null;
    
    try {
      const responseClone = response.clone();
      errorData = await responseClone.json();
      if (errorData?.error) {
        errorMessage = errorData.error;
      } else if (errorData?.message) {
        errorMessage = errorData.message;
      }
    } catch (e) {
      // If parsing JSON fails, try getting text
      try {
        const responseClone = response.clone();
        const responseText = await responseClone.text();
        if (responseText) {
          errorMessage = responseText;
        }
      } catch (textError) {
        // Keep the default error message
      }
    }
    
    // Only clear token on actual auth errors, not network errors
    if (response.status === 401) {
      console.log(`🌐 Auth error detected for ${url}: ${errorMessage}`);
      // Clear token for explicit auth errors or when checking current user
      if (
        errorMessage.includes('Invalid token') ||
        errorMessage.includes('No token provided') ||
        errorMessage.includes('User not authenticated') ||
        String(url).includes('/api/auth/user')
      ) {
        console.log('🌐 Clearing token due to auth error in queryClient');
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      } else {
        console.log('🌐 401 error but not clearing token (different error type)');
      }
    }
    
    const error = new Error(errorMessage);
    (error as any).status = response.status;
    (error as any).data = errorData;
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
      queryFn: async ({ queryKey }) => {
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
      // Don't retry queries that fail due to auth errors
      retryOnMount: false,
    },
  },
});