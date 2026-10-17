import { useEffect, useState } from 'react';

const readPath = () => window.location.hash.replace(/^#\/?/, '') || 'welcome';
export function useHashNavigation() {
  const [path, setPath] = useState(readPath);
  useEffect(() => {
    const sync = () => setPath(readPath());
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => { window.removeEventListener('hashchange', sync); window.removeEventListener('popstate', sync); };
  }, []);
  function navigate(next) {
    if (next === path) return;
    window.history.pushState(null, '', `#${next}`);
    setPath(next);
  }
  return { path, route: path.split('/')[0], param: path.split('/')[1], navigate };
}
