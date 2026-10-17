import { AuthProvider } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import AppShell from './components/layout/AppShell';
import AppRouter from './app/AppRouter';
export default function App() {
  return <AuthProvider><AppProvider><AppShell><AppRouter /></AppShell></AppProvider></AuthProvider>;
}
