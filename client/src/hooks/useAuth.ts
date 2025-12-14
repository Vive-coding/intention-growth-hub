import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { apiRequest } from "@/lib/queryClient";
import { analytics } from "@/services/analyticsService";

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
  // Initialize lastUserIdRef from stored user to handle page refreshes
  const lastUserIdRef = useRef<string | null>(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        return (parsed as any)?.id || null;
      } catch {
        return null;
      }
    }
    return null;
  }());

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
        apiRequest('/api/users/timezone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ timezone: tz })
      }).catch(() => {});
    } catch {}
  }, [hasToken, (serverUser as any)?.id]);

  const login = async (userData: any) => {
    console.log("🔐 Login called with userData:", userData);
    const newUserId = (userData as any)?.id;
    const previousUserId = lastUserIdRef.current;
    const existingLocalStorage = localStorage.getItem("onboardingCompleted");
    
    // If this is a different user logging in, clear all onboarding-related localStorage
    // This prevents User A's onboarding state from affecting User B
    if (previousUserId && previousUserId !== newUserId) {
      console.log("🔐 Different user detected - clearing onboarding localStorage");
      localStorage.removeItem("onboardingCompleted");
      localStorage.removeItem("bypassOnboarding");
      localStorage.removeItem("forceShowOnboarding");
      localStorage.removeItem("onboardingStartStep");
    }
    
    setUser(userData);
    
    // Sync onboarding flag from database for the current user
    const dbCompleted = (userData as any)?.onboardingCompleted ?? false;
    
    // Trust localStorage over DB if:
    // 1. Same user (not a user change)
    // 2. localStorage says "true" but DB says "false"
    // This handles cases where user skipped/completed onboarding but DB update failed
    if (existingLocalStorage === "true" && !dbCompleted && previousUserId === newUserId) {
      console.log("🔐 localStorage says onboarding completed but DB doesn't - updating DB to match localStorage");
      // Update DB to match localStorage (user likely skipped/completed but DB update failed)
      try {
        await apiRequest('/api/users/complete-onboarding', {
          method: 'POST',
        });
        console.log("🔐 ✅ DB updated to match localStorage");
        // Keep localStorage as "true"
        localStorage.setItem("onboardingCompleted", "true");
      } catch (error) {
        console.error("🔐 Failed to update DB to match localStorage:", error);
        // Still trust localStorage - user action was completed
        localStorage.setItem("onboardingCompleted", "true");
      }
    } else {
      // Normal sync: use DB value
      localStorage.setItem("onboardingCompleted", dbCompleted ? "true" : "false");
    }
    
    // Clear bypass flag on fresh login to ensure new users see onboarding
    // But only if onboarding is not completed
    const finalCompleted = existingLocalStorage === "true" && previousUserId === newUserId ? true : dbCompleted;
    if (!finalCompleted) {
      localStorage.removeItem("bypassOnboarding");
    }
    
    // Update the last user ID reference
    lastUserIdRef.current = newUserId;
    
    // Track login event
    analytics.setUser(userData.id, {
      email: userData.email,
      timezone: userData.timezone,
      createdAt: userData.createdAt,
    });
    analytics.trackUserLogin({
      user_id: userData.id,
      email: userData.email,
    });
    
    // Invalidate and refetch user data
    await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
  };

  const logout = () => {
    console.log("🔐 Logout called - clearing token and user");
    
    // Track logout event
    analytics.trackUserLogout();
    analytics.clearUser();
    
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("onboardingCompleted");
    localStorage.removeItem("bypassOnboarding");
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

  // When the authenticated user changes (e.g., on page load with existing token), sync onboarding flag
  useEffect(() => {
    const currentId = (serverUser as any)?.id;
    if (!currentId) return;
    
    const existingLocalStorage = localStorage.getItem("onboardingCompleted");
    const previousUserId = lastUserIdRef.current;
    
    // If this is a different user than we last saw, clear onboarding localStorage
    // This handles the case where User A was logged in, browser closed, User B opens browser
    if (previousUserId && previousUserId !== currentId) {
      console.log("🔐 User ID changed - clearing onboarding localStorage");
      localStorage.removeItem("onboardingCompleted");
      localStorage.removeItem("bypassOnboarding");
      localStorage.removeItem("forceShowOnboarding");
      localStorage.removeItem("onboardingStartStep");
    }
    
    // Sync onboarding flag from server to localStorage for current user
    if (lastUserIdRef.current !== currentId) {
      // Don't sync if user explicitly requested to return to onboarding
      const forceOnboarding = localStorage.getItem("forceShowOnboarding") === "true";
      if (!forceOnboarding) {
        const dbCompleted = (serverUser as any)?.onboardingCompleted ?? false;
        
        // Trust localStorage over DB if:
        // 1. Same user (not a user change - previousUserId check above handles that)
        // 2. localStorage says "true" but DB says "false"
        // This handles cases where user skipped/completed onboarding but DB update failed
        if (existingLocalStorage === "true" && !dbCompleted && previousUserId === currentId) {
          console.log("🔐 localStorage says onboarding completed but DB doesn't - updating DB to match localStorage");
          // Update DB to match localStorage (user likely skipped/completed but DB update failed)
          apiRequest('/api/users/complete-onboarding', {
            method: 'POST',
          }).then(() => {
            console.log("🔐 ✅ DB updated to match localStorage");
            // Keep localStorage as "true"
            localStorage.setItem("onboardingCompleted", "true");
            // Invalidate query to refetch updated user data
            queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
          }).catch((error) => {
            console.error("🔐 Failed to update DB to match localStorage:", error);
            // Still trust localStorage - user action was completed
            localStorage.setItem("onboardingCompleted", "true");
          });
        } else {
          // Normal sync: use DB value
          localStorage.setItem("onboardingCompleted", dbCompleted ? "true" : "false");
        }
      }
      // Don't clear bypassOnboarding here - let users keep their bypass preference
      // It will only be cleared on logout or when explicitly returning to onboarding
      lastUserIdRef.current = currentId;
    }
  }, [serverUser, queryClient]);

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