/**
 * useAgeGate - Age Gate Hook for Radio Check
 * 
 * Manages date of birth collection and age verification.
 * DOB is stored LOCALLY on the user's device for privacy.
 * 
 * Features:
 * - Under-18 detection with restricted access to certain features
 * - Age-appropriate safeguarding (higher sensitivity for minors)
 * - Privacy-first: DOB never sent to server, only the is_under_18 flag
 */

import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AGE_GATE_KEY = '@radio_check_dob';
const AGE_VERIFIED_KEY = '@radio_check_age_verified';
const AGE_GATE_SKIPPED_KEY = '@radio_check_age_gate_skipped';

export interface AgeGateState {
  isLoading: boolean;
  isAgeVerified: boolean;
  isUnder18: boolean;
  dateOfBirth: Date | null;
  ageInYears: number | null;
}

export interface AgeGateActions {
  setDateOfBirth: (dob: Date) => Promise<void>;
  setAgeUnverifiedProtected: () => Promise<void>;
  clearAgeData: () => Promise<void>;
  checkAge: () => Promise<boolean>;
}

/**
 * Calculate age from date of birth
 */
function calculateAge(dob: Date): number {
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  
  // Adjust if birthday hasn't occurred this year
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  
  return age;
}

/**
 * Check if user is under 18
 */
function isUserUnder18(dob: Date): boolean {
  return calculateAge(dob) < 18;
}

/**
 * Hook for managing age gate state
 */
export function useAgeGate(): AgeGateState & AgeGateActions {
  const [isLoading, setIsLoading] = useState(true);
  const [isAgeVerified, setIsAgeVerified] = useState(false);
  const [isUnder18, setIsUnder18] = useState(false);
  const [dateOfBirth, setDateOfBirthState] = useState<Date | null>(null);
  const [ageInYears, setAgeInYears] = useState<number | null>(null);

  /**
   * Load age data from local storage
   */
  const loadAgeData = useCallback(async () => {
    try {
      setIsLoading(true);
      
      const [storedDob, verified] = await Promise.all([
        AsyncStorage.getItem(AGE_GATE_KEY),
        AsyncStorage.getItem(AGE_VERIFIED_KEY),
      ]);
      
      if (storedDob && verified === 'true') {
        const dob = new Date(storedDob);
        const age = calculateAge(dob);
        const under18 = age < 18;
        
        setDateOfBirthState(dob);
        setAgeInYears(age);
        setIsUnder18(under18);
        setIsAgeVerified(true);
      } else {
        setIsAgeVerified(false);
        setIsUnder18(false);
        setDateOfBirthState(null);
        setAgeInYears(null);
      }
    } catch (error) {
      console.error('Error loading age data:', error);
      setIsAgeVerified(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Set date of birth and save to local storage
   */
  const setDateOfBirth = useCallback(async (dob: Date) => {
    try {
      const age = calculateAge(dob);
      const under18 = age < 18;
      
      // Store DOB locally (ISO string format)
      await AsyncStorage.setItem(AGE_GATE_KEY, dob.toISOString());
      await AsyncStorage.setItem(AGE_VERIFIED_KEY, 'true');
      
      setDateOfBirthState(dob);
      setAgeInYears(age);
      setIsUnder18(under18);
      setIsAgeVerified(true);
      
      console.log(`Age gate: User is ${age} years old, under18: ${under18}`);
    } catch (error) {
      console.error('Error saving age data:', error);
      throw error;
    }
  }, []);

  /**
   * Clear all age-related data
   */
  const clearAgeData = useCallback(async () => {
    try {
      await AsyncStorage.multiRemove([AGE_GATE_KEY, AGE_VERIFIED_KEY]);
      setDateOfBirthState(null);
      setAgeInYears(null);
      setIsUnder18(false);
      setIsAgeVerified(false);
    } catch (error) {
      console.error('Error clearing age data:', error);
      throw error;
    }
  }, []);

  /**
   * Check and refresh age status (useful for recalculating on app return)
   */
  const checkAge = useCallback(async (): Promise<boolean> => {
    await loadAgeData();
    return isUnder18;
  }, [loadAgeData, isUnder18]);

  /**
   * Skip path - FAILS SAFE.
   *
   * If the user declines to give a date of birth we do NOT get to assume they
   * are an adult. isUnder18 defaults to false (useState(false)), so before
   * this existed, skipping the gate produced full adult treatment: adult risk
   * thresholds, peer matching, direct calls. That made the gate optional for
   * exactly the people it protects.
   *
   * We record no DOB (there isn't one) and leave isAgeVerified false, so this
   * is not a claim that the user is a minor - it is a refusal to assume they
   * are not. Per safety_monitor.py: assume risk rather than dismiss it.
   */
  const setAgeUnverifiedProtected = useCallback(async () => {
    setIsUnder18(true);
    setIsAgeVerified(false);
    await AsyncStorage.setItem(AGE_GATE_SKIPPED_KEY, 'true');
  }, []);

  // Load age data on mount
  useEffect(() => {
    loadAgeData();
  }, [loadAgeData]);

  return {
    isLoading,
    isAgeVerified,
    isUnder18,
    dateOfBirth,
    ageInYears,
    setDateOfBirth,
    setAgeUnverifiedProtected,
    clearAgeData,
    checkAge,
  };
}

/**
 * Restricted features for under-18 users
 */
export const UNDER_18_RESTRICTIONS = {
  // These features are DISABLED for under-18 users
  restrictedFeatures: [
    'peer_matching',      // Buddy finder / peer matching
    'direct_peer_calls',  // Direct calls to peers
    'share_phone_number', // Sharing phone number
  ],
  
  // These features have MODIFIED behavior for under-18 users
  modifiedFeatures: {
    crisis_sensitivity: '+30%',   // Increased crisis sensitivity
    human_escalation: 'accelerated', // Faster escalation to staff
    safeguarding_messages: 'stronger', // More protective messaging
    risk_score_multiplier: 1.3,   // Higher risk scores
  },
  
  // Messages shown for restricted features
  restrictionMessages: {
    peer_matching: 'Peer matching is only available for users 18 and over. You can still access our AI support team and speak with trained staff.',
    direct_peer_calls: 'Direct peer calls are only available for users 18 and over. You can still chat with our AI team or request a call with a staff member.',
    share_phone_number: 'Phone number sharing is restricted for users under 18.',
  },
};

/**
 * Check if a feature is available for the user based on age
 */
export function isFeatureAvailable(feature: string, isUnder18: boolean): boolean {
  if (!isUnder18) return true;
  return !UNDER_18_RESTRICTIONS.restrictedFeatures.includes(feature);
}

/**
 * Get the restriction message for a feature
 */
export function getRestrictionMessage(feature: string): string {
  return UNDER_18_RESTRICTIONS.restrictionMessages[feature as keyof typeof UNDER_18_RESTRICTIONS.restrictionMessages] || 
    'This feature is not available for users under 18.';
}
