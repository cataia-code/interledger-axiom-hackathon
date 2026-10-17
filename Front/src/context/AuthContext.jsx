import { createContext, useContext, useEffect, useState } from 'react';
import { authService } from '../services/auth/authService';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [restoring, setRestoring] = useState(true);
  useEffect(() => { let active = true; authService.getSession().then(session => { if (active) setUser(session); }).catch(() => {}).finally(() => { if (active) setRestoring(false); }); return () => { active = false; }; }, []);
  async function authenticate(values, register = false) { const account = await authService[register ? 'register' : 'login'](values); setUser(account); return account; }
  async function logout() { await authService.logout(); setUser(null); }
  return <AuthContext.Provider value={{ user, restoring, authenticate, logout }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
