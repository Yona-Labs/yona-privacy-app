import { useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { PublicKey } from '@solana/web3.js';

const REFERRAL_CODE_KEY = 'referralCode';

/**
 * Validates if a string is a valid Solana public key
 */
function isValidPublicKey(key: string): boolean {
  try {
    new PublicKey(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * Hook to handle referral code from URL query parameter
 * Validates that the referral code is a valid Solana public key
 * Saves the referral code to localStorage if not already present
 * and removes it from the URL
 */
export function useReferralCode() {
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const refParam = searchParams.get('ref');
    
    if (refParam) {
      // Check if referral code already exists in localStorage
      const existingReferralCode = localStorage.getItem(REFERRAL_CODE_KEY);
      
      if (!existingReferralCode) {
        // Validate that refParam is a valid Solana public key
        if (isValidPublicKey(refParam)) {
          // Save referral code to localStorage
          localStorage.setItem(REFERRAL_CODE_KEY, refParam);
          console.log('Referral code saved:', refParam);
        } else {
          console.warn('Invalid referral code (not a valid Solana public key):', refParam);
        }
      }
      
      // Remove 'ref' parameter from URL regardless of validity
      searchParams.delete('ref');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  return {
    getReferralCode: () => localStorage.getItem(REFERRAL_CODE_KEY),
    clearReferralCode: () => localStorage.removeItem(REFERRAL_CODE_KEY),
  };
}

