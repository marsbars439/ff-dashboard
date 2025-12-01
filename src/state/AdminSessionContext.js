import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const AdminSessionContext = createContext(null);

const ADMIN_AUTH_STORAGE_KEY = 'ff-dashboard-admin-authorized';
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || (process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:3001/api');

const readStoredAdminSession = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage?.getItem(ADMIN_AUTH_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const token = typeof parsed.token === 'string' ? parsed.token : null;
    const expiresAt = parsed.expiresAt || null;

    if (token) {
      return { token, expiresAt };
    }
  } catch (error) {
    console.warn('Unable to read stored admin session:', error);
  }

  return null;
};

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

export const AdminSessionProvider = ({ children }) => {
  const [adminSession, setAdminSession] = useState(() => {
    const storedSession = readStoredAdminSession();

    if (storedSession) {
      return { ...storedSession, status: 'pending' };
    }

    return { token: null, expiresAt: null, status: 'unauthorized' };
  });
  const [adminAuthLoading, setAdminAuthLoading] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminPasswordError, setAdminPasswordError] = useState(null);

  const persistAdminSession = useCallback((session) => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      if (session && session.token) {
        window.localStorage?.setItem(
          ADMIN_AUTH_STORAGE_KEY,
          JSON.stringify({
            token: session.token,
            expiresAt: session.expiresAt || null
          })
        );
      } else {
        window.localStorage?.removeItem(ADMIN_AUTH_STORAGE_KEY);
      }
    } catch (error) {
      console.warn('Unable to update stored admin session:', error);
    }
  }, []);

  const invalidateAdminSession = useCallback(() => {
    setAdminSession({ token: null, expiresAt: null, status: 'unauthorized' });
    persistAdminSession(null);
  }, [persistAdminSession]);

  const validateAdminToken = useCallback(
    async (token) => {
      if (!token) {
        invalidateAdminSession();
        return;
      }

      setAdminAuthLoading(true);

      try {
        const response = await fetch(`${API_BASE_URL}/admin-auth`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });

        const data = await parseJsonResponse(response);

        if (!response.ok || !data?.success) {
          throw new Error(data?.error || 'Admin session validation failed');
        }

        const nextSession = {
          token: data.token || token,
          expiresAt: data.expiresAt || null,
          status: 'authorized'
        };

        setAdminSession(nextSession);
        persistAdminSession(nextSession);
        setAdminPasswordError(null);
      } catch (error) {
        console.warn('Admin token validation failed:', error);
        invalidateAdminSession();
        setAdminPasswordError('Your admin session has expired. Please sign in again.');
      } finally {
        setAdminAuthLoading(false);
      }
    },
    [invalidateAdminSession, parseJsonResponse, persistAdminSession]
  );

  useEffect(() => {
    if (adminSession.status === 'pending' && adminSession.token) {
      validateAdminToken(adminSession.token);
    }
  }, [adminSession.status, adminSession.token, validateAdminToken]);

  const adminAuthorized = adminSession.status === 'authorized';

  const enforceAdminTabAccess = useCallback(
    (requestedTab) => {
      if (!adminAuthorized && requestedTab === 'analytics') {
        return 'admin';
      }

      return requestedTab;
    },
    [adminAuthorized]
  );

  const handleAdminAuthSubmit = useCallback(
    async (event) => {
      if (event?.preventDefault) {
        event.preventDefault();
      }

      if (!adminPasswordInput) {
        setAdminPasswordError('Password is required');
        return;
      }

      setAdminAuthLoading(true);
      setAdminPasswordError(null);

      try {
        const response = await fetch(`${API_BASE_URL}/admin-auth`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: adminPasswordInput })
        });

        const data = await parseJsonResponse(response);

        if (!response.ok || !data?.success) {
          throw new Error(data?.error || 'Unable to authenticate');
        }

        const nextSession = {
          token: data.token || null,
          expiresAt: data.expiresAt || null,
          status: 'authorized'
        };

        setAdminSession(nextSession);
        persistAdminSession(nextSession);
        setAdminPasswordInput('');
      } catch (error) {
        console.warn('Admin authentication failed:', error);
        invalidateAdminSession();
        setAdminPasswordError(error.message || 'Authentication failed');
      } finally {
        setAdminAuthLoading(false);
      }
    },
    [adminPasswordInput, invalidateAdminSession, parseJsonResponse, persistAdminSession]
  );

  const handleAdminSignOut = useCallback(() => {
    invalidateAdminSession();
    setAdminAuthLoading(false);
    setAdminPasswordInput('');
    setAdminPasswordError(null);
  }, [invalidateAdminSession]);

  const value = useMemo(
    () => ({
      adminSession,
      adminAuthorized,
      adminAuthLoading,
      adminPasswordInput,
      setAdminPasswordInput,
      adminPasswordError,
      setAdminPasswordError,
      handleAdminAuthSubmit,
      handleAdminSignOut,
      invalidateAdminSession,
      enforceAdminTabAccess
    }),
    [
      adminSession,
      adminAuthorized,
      adminAuthLoading,
      adminPasswordInput,
      adminPasswordError,
      handleAdminAuthSubmit,
      handleAdminSignOut,
      invalidateAdminSession,
      enforceAdminTabAccess
    ]
  );

  return (
    <AdminSessionContext.Provider value={value}>
      {children}
    </AdminSessionContext.Provider>
  );
};

export const useAdminSession = () => {
  const context = useContext(AdminSessionContext);

  if (!context) {
    throw new Error('useAdminSession must be used within an AdminSessionProvider');
  }

  return context;
};

