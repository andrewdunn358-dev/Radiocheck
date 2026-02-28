/**
 * AgeGateContext - Global Age Gate State Context
 * 
 * Provides age verification state across the entire app.
 * Used to check if features should be restricted for under-18 users.
 */

import React, { createContext, useContext, ReactNode } from 'react';
import { useAgeGate, AgeGateState, AgeGateActions } from '../hooks/useAgeGate';

type AgeGateContextType = AgeGateState & AgeGateActions;

const AgeGateContext = createContext<AgeGateContextType | undefined>(undefined);

interface AgeGateProviderProps {
  children: ReactNode;
}

export function AgeGateProvider({ children }: AgeGateProviderProps) {
  const ageGateState = useAgeGate();
  
  return (
    <AgeGateContext.Provider value={ageGateState}>
      {children}
    </AgeGateContext.Provider>
  );
}

export function useAgeGateContext(): AgeGateContextType {
  const context = useContext(AgeGateContext);
  if (context === undefined) {
    throw new Error('useAgeGateContext must be used within an AgeGateProvider');
  }
  return context;
}

// Re-export utility functions
export { isFeatureAvailable, getRestrictionMessage, UNDER_18_RESTRICTIONS } from '../hooks/useAgeGate';
