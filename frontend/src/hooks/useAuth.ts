import { useState } from 'react';
import api from '@/lib/api';
import { clearAdminSession, setAdminSession } from '@/lib/authStorage';

export function useAuth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function login(email: string, password: string) {
    setLoading(true); setError(null);
    try {
      const { token, user } = await api.login(email, password);
      setAdminSession(token, user);
      return user;
    } catch (e: any) {
      setError(e?.message || 'Error de autenticación');
      throw e;
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    clearAdminSession();
  }

  return { login, logout, loading, error };
}
