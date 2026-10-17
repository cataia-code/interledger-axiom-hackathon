import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { authService } from '../services/auth/authService';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const authBusy = useRef(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [restoring, setRestoring] = useState(true);
  useEffect(() => { let active = true; authService.getSession().then(session => { if (active) setUser(session); }).catch(() => {}).finally(() => { if (active) setRestoring(false); }); return () => { active = false; }; }, []);
  useEffect(() => { const expire = () => { setUser(null); setSessionExpired(true); }; window.addEventListener('lokora:session-expired', expire); return () => window.removeEventListener('lokora:session-expired', expire); }, []);
  async function authenticateAccount(method, values) {
    if (authBusy.current) throw new Error('Espera a que termine el inicio de sesión.');
    authBusy.current = true;
    try { const account = await authService[method](values); setSessionExpired(false); setUser(account); return account; }
    finally { authBusy.current = false; }
  }
  const authenticate = (values, register = false) => authenticateAccount(register ? 'register' : 'login', values);
  const authenticateWithOTP = values => authenticateAccount('loginWithOTP', values);
  async function refreshSession() { const account = await authService.getSession(); setUser(account); return account; }
  async function logout() { try { await authService.logout(); } finally { setUser(null); } }
  return <AuthContext.Provider value={{ user, restoring, sessionExpired, authenticate, authenticateWithOTP, refreshSession, logout }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
