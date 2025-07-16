import { useState, useEffect } from 'react';

export type ViewMode = 'overall' | 'by-metric';
export type LifeMetricCategory = 'Mental Health' | 'Physical Health' | 'Social' | 'Productivity' | 'Nutrition' | 'Investments' | null;

interface UseLifeMetricViewProps {
  initialViewMode?: ViewMode;
  initialSelectedMetric?: LifeMetricCategory;
  initialTimePeriod?: string;
}

export const useLifeMetricView = ({
  initialViewMode = 'overall',
  initialSelectedMetric = null,
  initialTimePeriod = 'This Month'
}: UseLifeMetricViewProps = {}) => {
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);
  const [selectedMetric, setSelectedMetric] = useState<LifeMetricCategory>(initialSelectedMetric);
  const [timePeriod, setTimePeriod] = useState(initialTimePeriod);

  // Persist time period across app
  useEffect(() => {
    const savedTimePeriod = localStorage.getItem('lifeMetricTimePeriod');
    if (savedTimePeriod) {
      setTimePeriod(savedTimePeriod);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('lifeMetricTimePeriod', timePeriod);
  }, [timePeriod]);

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    if (mode === 'overall') {
      setSelectedMetric(null);
    }
  };

  const handleMetricClick = (metric: string) => {
    setSelectedMetric(metric as LifeMetricCategory);
    setViewMode('by-metric');
  };

  const clearMetricFilter = () => {
    setSelectedMetric(null);
    setViewMode('overall');
  };

  const getBreadcrumbs = () => {
    const crumbs = [];
    if (selectedMetric) {
      crumbs.push(selectedMetric);
    }
    if (timePeriod !== 'This Month') {
      crumbs.push(timePeriod);
    }
    return crumbs;
  };

  return {
    viewMode,
    selectedMetric,
    timePeriod,
    handleViewModeChange,
    handleMetricClick,
    clearMetricFilter,
    setTimePeriod,
    getBreadcrumbs
  };
};