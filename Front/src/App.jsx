import { LocaleProvider } from './context/LocaleContext';
import { CartProvider } from './context/CartContext';
import { AuthProvider } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import AppShell from './components/layout/AppShell';
import AppRouter from './app/AppRouter';
export default function App() {
  return <AuthProvider><LocaleProvider><CartProvider><AppProvider><AppShell><AppRouter /></AppShell></AppProvider></CartProvider></LocaleProvider></AuthProvider>;
}
