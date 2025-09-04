// Hook for tracking page views
import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { analytics } from '@/services/analyticsService';

export function usePageTracking() {
  const [location] = useLocation();

  useEffect(() => {
    // Track page view when location changes
    const pageName = getPageNameFromPath(location);
    analytics.trackPageView(pageName, {
      path: location,
      timestamp: new Date().toISOString(),
    });
  }, [location]);
}

function getPageNameFromPath(path: string): string {
  switch (path) {
    case '/':
      return 'Dashboard';
    case '/landing':
      return 'Landing';
    case '/insights':
      return 'Insights';
    case '/habits':
      return 'Habits';
    case '/goals':
      return 'Goals';
    case '/journals':
      return 'Journals';
    default:
      return 'Unknown';
  }
}
