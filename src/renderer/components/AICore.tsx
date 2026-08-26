import { motion } from 'framer-motion'
import React from 'react'
import { AIState } from '../../shared/types'

interface AICoreProps {
  state: AIState;
}

export const AICore: React.FC<AICoreProps> = ({ state }) => {
  // Determine color and animation speed based on state
  const isError = state === AIState.ERROR;
  const isOffline = state === AIState.OFFLINE;
  const color = isError ? '#ff2a2a' : isOffline ? '#4a5568' : '#00f3ff';
  
  const getVariants = () => {
    switch (state) {
      case AIState.LISTENING:
        return { scale: [1, 1.1, 1], rotate: 360, transition: { duration: 1.5, repeat: Infinity } };
      case AIState.PROCESSING:
        return { scale: [1, 1.05, 1], rotate: -360, transition: { duration: 1, repeat: Infinity } };
      case AIState.SPEAKING:
        return { scale: [1, 1.2, 0.9, 1.1, 1], transition: { duration: 0.5, repeat: Infinity } };
      case AIState.ERROR:
      case AIState.OFFLINE:
        return { scale: 1, opacity: 0.5 };
      default: // IDLE / ONLINE
        return { scale: [1, 1.02, 1], opacity: [0.8, 1, 0.8], transition: { duration: 4, repeat: Infinity } };
    }
  };

  return (
    <div className="relative flex items-center justify-center w-64 h-64">
      {/* Outer Glow */}
      <motion.div 
        animate={getVariants()}
        className="absolute w-full h-full rounded-full opacity-20 blur-xl"
        style={{ backgroundColor: color }}
      />
      
      {/* Outer Ring */}
      <motion.div
        animate={state === AIState.PROCESSING ? { rotate: 360 } : { rotate: 0 }}
        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        className="absolute w-56 h-56 rounded-full border border-dashed opacity-40"
        style={{ borderColor: color }}
      />
      
      {/* Inner Ring */}
      <motion.div
        animate={getVariants()}
        className="absolute w-40 h-40 rounded-full border-2 opacity-60"
        style={{ borderColor: color }}
      />
      
      {/* Core Center */}
      <motion.div
        animate={getVariants()}
        className="absolute w-24 h-24 rounded-full shadow-[0_0_30px_rgba(0,243,255,0.8)]"
        style={{ backgroundColor: color, boxShadow: `0 0 40px ${color}` }}
      />
    </div>
  );
};