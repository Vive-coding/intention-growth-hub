import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { Bug, Database, RefreshCw, AlertTriangle } from "lucide-react";

interface DebugSnapshotsProps {
  metric: string;
  selectedPeriod: string;
}

export const DebugSnapshots: React.FC<DebugSnapshotsProps> = ({ metric, selectedPeriod }) => {
  const [debugData, setDebugData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runDebug = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('🔍 Starting snapshot debug for:', { metric, selectedPeriod });
      
      // 1. Test progress snapshots API
      const snapshotsUrl = `/api/life-metrics/${encodeURIComponent(metric)}/progress-snapshots?period=${encodeURIComponent(selectedPeriod)}`;
      console.log('📡 Fetching snapshots from:', snapshotsUrl);
      
      const snapshots = await apiRequest(snapshotsUrl);
      console.log('📊 Snapshots response:', snapshots);
      
      // 2. Test current progress API
      const progressUrl = '/api/life-metrics/progress';
      console.log('📡 Fetching current progress from:', progressUrl);
      
      const currentProgress = await apiRequest(progressUrl);
      console.log('📈 Current progress response:', currentProgress);
      
      // 3. Test goals API
      const goalsUrl = `/api/goals?metric=${encodeURIComponent(metric)}`;
      console.log('📡 Fetching goals from:', goalsUrl);
      
      const goals = await apiRequest(goalsUrl);
      console.log('🎯 Goals response:', goals);
      
      // 4. Test metric progress hook data
      const metricProgressUrl = `/api/life-metrics/${encodeURIComponent(metric)}/progress?period=${encodeURIComponent(selectedPeriod)}`;
      console.log('📡 Fetching metric progress from:', metricProgressUrl);
      
      let metricProgress = null;
      try {
        metricProgress = await apiRequest(metricProgressUrl);
        console.log('📊 Metric progress response:', metricProgress);
      } catch (e) {
        console.warn('⚠️ Metric progress endpoint not found, using fallback');
      }
      
      const debugResult = {
        timestamp: new Date().toISOString(),
        metric,
        selectedPeriod,
        snapshots: {
          url: snapshotsUrl,
          data: snapshots,
          count: Array.isArray(snapshots) ? snapshots.length : 0,
          sample: Array.isArray(snapshots) ? snapshots.slice(0, 3) : null
        },
        currentProgress: {
          url: progressUrl,
          data: currentProgress,
          metricData: Array.isArray(currentProgress) ? currentProgress.find((m: any) => m.name === metric) : null
        },
        goals: {
          url: goalsUrl,
          data: goals,
          count: Array.isArray(goals) ? goals.length : 0,
          sample: Array.isArray(goals) ? goals.slice(0, 3) : null
        },
        metricProgress: {
          url: metricProgressUrl,
          data: metricProgress,
          available: metricProgress !== null
        }
      };
      
      setDebugData(debugResult);
      console.log('✅ Debug complete:', debugResult);
      
    } catch (err) {
      console.error('❌ Debug failed:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const clearDebug = () => {
    setDebugData(null);
    setError(null);
  };

  return (
    <Card className="mb-6 border-orange-200 bg-orange-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center space-x-2 text-orange-800">
          <Bug className="w-5 h-5" />
          <span>Snapshot Debug Tool</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center space-x-2">
          <Button 
            onClick={runDebug} 
            disabled={isLoading}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {isLoading ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Database className="w-4 h-4 mr-2" />
            )}
            {isLoading ? 'Debugging...' : 'Run Debug'}
          </Button>
          <Button 
            onClick={clearDebug} 
            variant="outline"
            disabled={isLoading}
          >
            Clear
          </Button>
        </div>

        {error && (
          <div className="p-3 bg-red-100 border border-red-300 rounded-md">
            <div className="flex items-center space-x-2 text-red-800">
              <AlertTriangle className="w-4 h-4" />
              <span className="font-medium">Error:</span>
            </div>
            <p className="text-red-700 mt-1">{error}</p>
          </div>
        )}

        {debugData && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Snapshots */}
              <Card className="border-blue-200 bg-blue-50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-blue-800">Progress Snapshots</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-xs text-blue-700">
                    <strong>URL:</strong> {debugData.snapshots.url}
                  </div>
                  <div className="text-xs text-blue-700">
                    <strong>Count:</strong> {debugData.snapshots.count}
                  </div>
                  {debugData.snapshots.sample && debugData.snapshots.sample.length > 0 && (
                    <div className="text-xs text-blue-700">
                      <strong>Sample:</strong>
                      <pre className="mt-1 p-2 bg-blue-100 rounded text-xs overflow-x-auto">
                        {JSON.stringify(debugData.snapshots.sample, null, 2)}
                      </pre>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Current Progress */}
              <Card className="border-green-200 bg-green-50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-green-800">Current Progress</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-xs text-green-700">
                    <strong>URL:</strong> {debugData.currentProgress.url}
                  </div>
                  {debugData.currentProgress.metricData && (
                    <div className="text-xs text-green-700">
                      <strong>Metric Data:</strong>
                      <pre className="mt-1 p-2 bg-green-100 rounded text-xs overflow-x-auto">
                        {JSON.stringify(debugData.currentProgress.metricData, null, 2)}
                      </pre>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Goals */}
              <Card className="border-purple-200 bg-purple-50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-purple-800">Goals</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-xs text-purple-700">
                    <strong>URL:</strong> {debugData.goals.url}
                  </div>
                  <div className="text-xs text-purple-700">
                    <strong>Count:</strong> {debugData.goals.count}
                  </div>
                  {debugData.goals.sample && debugData.goals.sample.length > 0 && (
                    <div className="text-xs text-purple-700">
                      <strong>Sample:</strong>
                      <pre className="mt-1 p-2 bg-purple-100 rounded text-xs overflow-x-auto">
                        {JSON.stringify(debugData.goals.sample, null, 2)}
                      </pre>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Metric Progress */}
              <Card className="border-indigo-200 bg-indigo-50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-indigo-800">Metric Progress</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-xs text-indigo-700">
                    <strong>URL:</strong> {debugData.metricProgress.url}
                  </div>
                  <div className="text-xs text-indigo-700">
                    <strong>Available:</strong> {debugData.metricProgress.available ? 'Yes' : 'No'}
                  </div>
                  {debugData.metricProgress.data && (
                    <div className="text-xs text-indigo-700">
                      <strong>Data:</strong>
                      <pre className="mt-1 p-2 bg-indigo-100 rounded text-xs overflow-x-auto">
                        {JSON.stringify(debugData.metricProgress.data, null, 2)}
                      </pre>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Summary */}
            <Card className="border-gray-200 bg-gray-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-800">Debug Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div className="text-center">
                    <div className="font-medium text-gray-700">Snapshots</div>
                    <Badge variant={debugData.snapshots.count > 0 ? "default" : "destructive"}>
                      {debugData.snapshots.count}
                    </Badge>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-gray-700">Goals</div>
                    <Badge variant={debugData.goals.count > 0 ? "default" : "destructive"}>
                      {debugData.goals.count}
                    </Badge>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-gray-700">Progress Data</div>
                    <Badge variant={debugData.currentProgress.metricData ? "default" : "destructive"}>
                      {debugData.currentProgress.metricData ? "Yes" : "No"}
                    </Badge>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-gray-700">Metric API</div>
                    <Badge variant={debugData.metricProgress.available ? "default" : "destructive"}>
                      {debugData.metricProgress.available ? "Yes" : "No"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
