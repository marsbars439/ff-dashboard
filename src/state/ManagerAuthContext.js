import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';

const DEFAULT_API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
const DEFAULT_STORAGE_KEY = 'ff-dashboard-manager-auth';

const INITIAL_MANAGER_AUTH_STATE = {
  managerId: '',
  managerName: '',
  token: '',
  expiresAt: null,
  status: 'unauthenticated',
  verificationSource: null
};

const ManagerAuthContext = createContext(null);

const parseJsonResponse = async (response) => {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    console.warn('Unable to parse JSON response:', error);
    return {};
  }
};

export const ManagerAuthProvider = ({
  children,
  apiBaseUrl = DEFAULT_API_BASE_URL,
  storageKey = DEFAULT_STORAGE_KEY
}) => {
  const [managerAuth, setManagerAuth] = useState(INITIAL_MANAGER_AUTH_STATE);
  const [managerAuthInitialized, setManagerAuthInitialized] = useState(false);
  const [managerAuthSelection, setManagerAuthSelection] = useState('');
  const [managerAuthPasscode, setManagerAuthPasscode] = useState('');
  const [managerAuthError, setManagerAuthError] = useState(null);
  const [managerAuthLoading, setManagerAuthLoading] = useState(false);

  const managerAuthRef = useRef(managerAuth);
  const cloudflareAuthAttemptedRef = useRef(false);
  const cloudflareAbortControllerRef = useRef(null);
  const cloudflareAuthTimeoutRef = useRef(null);
  const isUnmountedRef = useRef(false);

  useEffect(() => {
    isUnmountedRef.current = false;
    return () => {
      isUnmountedRef.current = true;
      // Reset the cloudflare attempt flag so it can retry on remount
      cloudflareAuthAttemptedRef.current = false;
    };
  }, []);

  useEffect(() => {
    managerAuthRef.current = managerAuth;
  }, [managerAuth]);

  const persistManagerAuth = useCallback((payload) => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      if (payload) {
        window.localStorage?.setItem(storageKey, JSON.stringify(payload));
      } else {
        window.localStorage?.removeItem(storageKey);
      }
    } catch (error) {
      console.warn('Unable to update stored manager authentication:', error);
    }
  }, [storageKey]);

  const clearManagerAuth = useCallback((message = null) => {
    setManagerAuth(INITIAL_MANAGER_AUTH_STATE);
    setManagerAuthSelection('');
    setManagerAuthPasscode('');
    setManagerAuthLoading(false);

    if (typeof message === 'string') {
      setManagerAuthError(message);
    } else {
      setManagerAuthError(null);
    }

    persistManagerAuth(null);
  }, [persistManagerAuth]);

  const validateManagerToken = useCallback(async (managerId, token) => {
    if (!managerId || !token) {
      clearManagerAuth();
      return;
    }

    setManagerAuthLoading(true);

    try {
      const response = await fetch(`${apiBaseUrl}/manager-auth/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ managerId, token })
      });

      const data = await parseJsonResponse(response);

      if (!response.ok) {
        throw new Error(data?.error || 'Manager token validation failed');
      }

      const normalizedAuth = {
        managerId: data.managerId || managerId,
        managerName: data.managerName || '',
        token,
        expiresAt: data.expiresAt || null,
        status: 'authenticated',
        verificationSource: 'storage'
      };

      setManagerAuth(normalizedAuth);
      setManagerAuthSelection(normalizedAuth.managerId);
      setManagerAuthError(null);
      persistManagerAuth({
        managerId: normalizedAuth.managerId,
        managerName: normalizedAuth.managerName,
        token: normalizedAuth.token,
        expiresAt: normalizedAuth.expiresAt
      });
    } catch (error) {
      console.warn('Manager token validation failed:', error);
      clearManagerAuth('Your manager session has expired. Please sign in again.');
    } finally {
      setManagerAuthLoading(false);
    }
  }, [apiBaseUrl, clearManagerAuth, persistManagerAuth]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    let storedAuth = null;

    try {
      const raw = window.localStorage?.getItem(storageKey);
      storedAuth = raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.warn('Unable to read stored manager authentication:', error);
    }

    if (storedAuth?.managerId && storedAuth?.token) {
      setManagerAuth(prev => ({
        ...prev,
        managerId: storedAuth.managerId,
        managerName: storedAuth.managerName || '',
        token: storedAuth.token,
        expiresAt: storedAuth.expiresAt || null,
        status: 'pending',
        verificationSource: 'storage'
      }));
      setManagerAuthSelection(storedAuth.managerId);
      validateManagerToken(storedAuth.managerId, storedAuth.token);
    }

    setManagerAuthInitialized(true);
  }, [storageKey, validateManagerToken]);

  const attemptCloudflareManagerVerification = useCallback(async () => {
    console.log('Attempting Cloudflare manager verification...');

    if (typeof window === 'undefined' || !managerAuthInitialized) {
      console.log('Skipping Cloudflare verification: window undefined or not initialized');
      return;
    }

    if (cloudflareAuthAttemptedRef.current) {
      console.log('Skipping Cloudflare verification: already attempted');
      return;
    }

    const currentAuth = managerAuthRef.current || {};
    if (currentAuth.status !== 'unauthenticated') {
      console.log('Skipping Cloudflare verification: status is', currentAuth.status);
      return;
    }

    cloudflareAuthAttemptedRef.current = true;

    const controller = new AbortController();
    cloudflareAbortControllerRef.current = controller;
    let didTimeout = false;

    if (cloudflareAuthTimeoutRef.current) {
      window.clearTimeout(cloudflareAuthTimeoutRef.current);
    }

    const timeoutId = window.setTimeout(() => {
      console.log('Cloudflare verification timeout triggered');
      didTimeout = true;
      controller.abort();
    }, 8000);
    cloudflareAuthTimeoutRef.current = timeoutId;

    console.log('Setting manager auth to pending (Cloudflare)...');
    setManagerAuth(prev => ({
      ...prev,
      status: 'pending',
      verificationSource: 'cloudflare'
    }));
    setManagerAuthError(null);
    setManagerAuthLoading(true);

    try {
      console.log('Fetching Cloudflare manager auth...');
      const response = await fetch(`${apiBaseUrl}/manager-auth/cloudflare`, {
        signal: controller.signal,
        credentials: 'include'
      });

      console.log('Cloudflare response received:', response.status, response.ok);
      const data = await parseJsonResponse(response);
      console.log('Parsed Cloudflare response data:', data);

      if (!response.ok || !data?.managerId || !data?.token) {
        console.log('Cloudflare verification failed - throwing error');
        throw new Error(data?.error || 'Cloudflare manager verification failed');
      }

      console.log('Cloudflare verification successful!');

      if (isUnmountedRef.current) {
        return;
      }

      const latestAuth = managerAuthRef.current;
      const canApplyCloudflareResult =
        !latestAuth ||
        latestAuth.status === 'unauthenticated' ||
        (latestAuth.status === 'pending' && latestAuth.verificationSource === 'cloudflare');

      if (!canApplyCloudflareResult) {
        return;
      }

      const normalizedAuth = {
        managerId: data.managerId,
        managerName: data.managerName || '',
        token: data.token,
        expiresAt: data.expiresAt || null,
        status: 'authenticated',
        verificationSource: 'cloudflare'
      };

      setManagerAuth(normalizedAuth);
      setManagerAuthSelection(normalizedAuth.managerId);
      setManagerAuthPasscode('');
      setManagerAuthError(null);
      persistManagerAuth({
        managerId: normalizedAuth.managerId,
        managerName: normalizedAuth.managerName,
        token: normalizedAuth.token,
        expiresAt: normalizedAuth.expiresAt
      });
    } catch (error) {
      console.log('ENTERED CATCH BLOCK');
      console.log('isUnmountedRef.current:', isUnmountedRef.current);

      console.warn('Cloudflare manager verification failed:', error);
      const latestAuth = managerAuthRef.current;
      console.log('Latest auth state during Cloudflare failure:', latestAuth);

      const shouldApplyCloudflareFailure =
        !latestAuth ||
        latestAuth.status === 'unauthenticated' ||
        (latestAuth.status === 'pending' && latestAuth.verificationSource === 'cloudflare');

      console.log('Should apply Cloudflare failure?', shouldApplyCloudflareFailure);

      if (shouldApplyCloudflareFailure) {
        const errorMessage = didTimeout
          ? 'Automatic manager verification timed out. Please enter your manager passcode.'
          : 'Unable to verify automatically. Please enter your manager passcode.';

        console.log('Resetting manager auth state after Cloudflare failure');
        if (!isUnmountedRef.current) {
          setManagerAuth(INITIAL_MANAGER_AUTH_STATE);
          setManagerAuthSelection('');
          setManagerAuthPasscode('');
          setManagerAuthError(errorMessage);
          setManagerAuthLoading(false);
          persistManagerAuth(null);
        } else {
          console.log('Skipping state updates because component is unmounted');
        }
      }
    } finally {
      window.clearTimeout(timeoutId);

      if (cloudflareAuthTimeoutRef.current === timeoutId) {
        cloudflareAuthTimeoutRef.current = null;
      }

      if (cloudflareAbortControllerRef.current === controller) {
        cloudflareAbortControllerRef.current = null;
      }

      if (!isUnmountedRef.current) {
        setManagerAuthLoading(false);
      }
    }
  }, [apiBaseUrl, managerAuthInitialized, persistManagerAuth]);

  useEffect(() => {
    if (!managerAuthInitialized || managerAuth.status !== 'unauthenticated') {
      return;
    }

    attemptCloudflareManagerVerification();
  }, [managerAuthInitialized, managerAuth.status, attemptCloudflareManagerVerification]);

  useEffect(() => {
    return () => {
      if (cloudflareAuthTimeoutRef.current) {
        window.clearTimeout(cloudflareAuthTimeoutRef.current);
      }

      if (cloudflareAbortControllerRef.current) {
        cloudflareAbortControllerRef.current.abort();
      }
    };
  }, []);

  const loginManager = useCallback(async () => {
    if (!managerAuthSelection || !managerAuthPasscode) {
      setManagerAuthError('Select your manager name and enter your passcode.');
      return { success: false, error: 'Select your manager name and enter your passcode.' };
    }

    setManagerAuthLoading(true);
    setManagerAuthError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/manager-auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ managerId: managerAuthSelection, passcode: managerAuthPasscode })
      });

      const data = await parseJsonResponse(response);

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to verify manager credentials');
      }

      const normalizedAuth = {
        managerId: data.managerId,
        managerName: data.managerName || '',
        token: data.token,
        expiresAt: data.expiresAt || null,
        status: 'authenticated',
        verificationSource: 'manual'
      };

      setManagerAuth(normalizedAuth);
      setManagerAuthSelection(normalizedAuth.managerId);
      setManagerAuthPasscode('');
      setManagerAuthError(null);
      persistManagerAuth({
        managerId: normalizedAuth.managerId,
        managerName: normalizedAuth.managerName,
        token: normalizedAuth.token,
        expiresAt: normalizedAuth.expiresAt
      });

      return { success: true, auth: normalizedAuth };
    } catch (error) {
      console.error('Manager authentication failed:', error);
      const previousSelection = managerAuthSelection;
      clearManagerAuth(error.message || 'Failed to verify manager credentials');
      setManagerAuthSelection(previousSelection);
      return { success: false, error: error.message || 'Failed to verify manager credentials' };
    } finally {
      setManagerAuthLoading(false);
    }
  }, [apiBaseUrl, clearManagerAuth, managerAuthPasscode, managerAuthSelection, persistManagerAuth]);

  const logoutManager = useCallback((message = null) => {
    clearManagerAuth(message);
  }, [clearManagerAuth]);

  const value = useMemo(() => ({
    managerAuth,
    managerAuthInitialized,
    managerAuthSelection,
    setManagerAuthSelection,
    managerAuthPasscode,
    setManagerAuthPasscode,
    managerAuthError,
    managerAuthLoading,
    clearManagerAuth,
    loginManager,
    logoutManager
  }), [
    managerAuth,
    managerAuthInitialized,
    managerAuthSelection,
    managerAuthPasscode,
    managerAuthError,
    managerAuthLoading,
    clearManagerAuth,
    loginManager,
    logoutManager
  ]);

  return (
    <ManagerAuthContext.Provider value={value}>
      {children}
    </ManagerAuthContext.Provider>
  );
};

export const useManagerAuth = () => {
  const context = useContext(ManagerAuthContext);
  if (!context) {
    throw new Error('useManagerAuth must be used within a ManagerAuthProvider');
  }
  return context;
};
