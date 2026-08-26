import { useEffect } from 'react'
import { useAppStore } from '../store'

export const useSystemMetrics = () => {
  const updateMetrics = useAppStore((state) => state.updateMetrics);

  useEffect(() => {
    if (window.jarvisAPI?.onMetricsUpdate) {
      const unsubscribe = window.jarvisAPI.onMetricsUpdate((metrics) => {
        updateMetrics(metrics);
      });
      return () => unsubscribe();
    }
  }, [updateMetrics]);
};