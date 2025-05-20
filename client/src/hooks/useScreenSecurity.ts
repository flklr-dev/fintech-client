import { useEffect } from 'react';

/**
 * A React hook for screen security
 * 
 * Note: Screenshot prevention is implemented at the app level in MainActivity.kt
 * using FLAG_SECURE for all screens.
 * 
 * This hook is kept as a placeholder for API compatibility.
 */
const useScreenSecurity = (secure: boolean = true): void => {
  // This is a no-op since screenshots are prevented at the app level
};

export default useScreenSecurity; 