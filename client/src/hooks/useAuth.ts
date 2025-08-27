import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";

// Global function to check token status (can be called from browser console)
if (typeof window !== 'undefined') {
  (window as any).checkTokenStatus = () => {
    const token = localStorage.getItem("token");
    const user = localStorage.getItem("user");
    console.log("🔍 Token Status Check:");
    console.log(`  Token: ${token ? 'PRESENT' : 'MISSING'}`);
    if (token) {
      console.log(`  Token length: ${token.length}`);
      console.log(`  Token preview: ${token.substring(0, 20)}...`);
    }
    console.log(`  User: ${user ? 'PRESENT' : 'MISSING'}`);
    if (user) {
      try {
        const userObj = JSON.parse(user);
        console.log(`  User ID: ${userObj.id}`);
      } catch (e) {
        console.log(`  User data invalid: ${e}`);
      }
    }
    return { token: !!token, user: !!user };
  };
}

export function useAuth() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem("user");
    return storedUser ? JSON.parse(storedUser) : null;
  });

  // Check if we have a token
  const hasToken = !!localStorage.getItem("token");

  // Debug token state
  useEffect(() => {
    const token = localStorage.getItem("token");
    console.log(`🔐 Token state changed: ${token ? 'PRESENT' : 'MISSING'}`);
    if (token) {
      console.log(`🔐 Token length: ${token.length} characters`);
    }
  }, [hasToken]);

  // Call user endpoint if we have a token
  const { data: serverUser, isLoading, error } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
    enabled: hasToken,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  
  // Send user timezone to server (one-time per session and when user changes)
  useEffect(() => {
    if (!hasToken) return;
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!tz) return;
      const apiBaseUrl = import.meta.env.VITE_API_URL || '';
      fetch(`${apiBaseUrl}/api/users/timezone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ timezone: tz })
      }).catch(() => {});
    } catch {}
  }, [hasToken, (serverUser as any)?.id]);

  const login = async (userData: any) => {
    console.log("🔐 Login called with userData:", userData);
    setUser(userData);
    // Invalidate and refetch user data
    await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
  };

  const logout = () => {
    console.log("🔐 Logout called - clearing token and user");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    queryClient.clear();
  };

  // Handle auth errors and clear invalid tokens - be more conservative
  useEffect(() => {
    if (error && hasToken) {
      // Only clear if it's a clear auth error, not a network error
      const errorMessage = error?.message || '';
      console.log(`🔐 Auth error detected: ${errorMessage}`);
      console.log(`🔐 Error details:`, error);
      
      // Be more specific about when to clear tokens
      if (errorMessage.includes('Invalid token') || errorMessage.includes('No token provided') || errorMessage.includes('User not authenticated')) {
        console.log("🔐 Clearing token due to specific auth error");
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setUser(null);
        // Clear all queries to prevent further API calls
        queryClient.clear();
      } else if (errorMessage.includes('401')) {
        console.log("🔐 401 error detected but checking if it's a network issue");
        // Don't clear token for generic 401s, only specific auth errors
      } else {
        console.log("🔐 Auth error but not clearing token (likely network error)");
      }
    }
  }, [error, hasToken, queryClient]);

  // Simple authentication logic
  const isAuthenticated = hasToken && !!(serverUser || user) && !error;
  const shouldShowAuthButton = !isAuthenticated;

  console.log(`🔐 Auth state: hasToken=${hasToken}, serverUser=${!!serverUser}, user=${!!user}, error=${!!error}, isAuthenticated=${isAuthenticated}`);

  return {
    user: serverUser || user,
    isLoading,
    isAuthenticated,
    shouldShowAuthButton,
    login,
    logout,
  };
}