import { Settings } from 'lucide-react'
import React from 'react'
import { AIState } from '../../shared/types'
import { useAppStore } from '../store'

export const Footer: React.FC = () => {
  const { systemMetrics, aiState } = useAppStore();

  const getStatusColor = () => {
    if (aiState === AIState.ERROR) return 'text-jarvis-red';
    if (aiState === AIState.OFFLINE) return 'text-gray-500';
    return 'text-jarvis-cyan';
  };

  return (
    <div className="absolute bottom-0 w-full h-10 border-t border-jarvis-cyan/20 bg-jarvis-panel/50 flex items-center justify-between px-6 font-mono text-xs text-jarvis-cyan/70">
      <button className="flex items-center gap-2 hover:text-jarvis-cyan transition-colors">
        <Settings size={14} />
        <span>Settings</span>
      </button>
      
      <div className="flex gap-6">
        <span>CPU {systemMetrics.cpuUsage}%</span>
        <span>TEMP {systemMetrics.cpuTemp ? `${systemMetrics.cpuTemp}°C` : 'N/A'}</span>
        <span>RAM {systemMetrics.ramUsage}%</span>
        <div className={`flex items-center gap-2 ${getStatusColor()} font-bold tracking-widest`}>
          <span className="animate-pulse">●</span>
          <span>{aiState}</span>
        </div>
      </div>
    </div>
  );
};