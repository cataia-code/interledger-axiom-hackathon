import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/tokens.css';
import './styles/global.css';
import './components/layout/layout.css';
import './components/ui/ui.css';
import './components/shops/shops.css';
import './components/map/map.css';
import './components/charts/charts.css';
import './pages/pages.css';
import './styles/motion.css';

createRoot(document.getElementById('root')).render(<App />);
