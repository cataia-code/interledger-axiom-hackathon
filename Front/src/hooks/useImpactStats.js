import { useCallback, useEffect, useMemo, useState } from 'react';
import { DATA_SOURCE } from '../services/api/client';
import { statsService, marketplaceView } from '../services/stats/statsService';
import { marketplaceStatsExample, storeStatsExample } from '../data/stats';

export function useImpactStats(userId, stores, { demo = false } = {}) {
  const storeIds = useMemo(() => stores.map(store => String(store.id)), [stores]);
  const idsKey = storeIds.join(',');
  const requestKey = `${userId || ''}:${idsKey}:${demo ? 'demo' : 'api'}`;
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState({ key: '', pending: true, marketplace: null, marketplaceError: null, storeStats: {}, storeErrors: {} });
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setResult({ key: requestKey, pending: true, marketplace: null, marketplaceError: null, storeStats: {}, storeErrors: {} });
    if (demo || DATA_SOURCE === 'mock') {
      const sampleId = storeIds.includes('4') ? '4' : storeIds[0];
      const storeStats = sampleId ? { [sampleId]: storeStatsExample(Number(sampleId) || sampleId) } : {};
      setResult({ key: requestKey, pending: false, marketplace: marketplaceView(marketplaceStatsExample), marketplaceError: null, storeStats, storeErrors: {}, demo: true });
      return () => { active = false; };
    }
    async function load() {
      const [overviewResult, rows] = await Promise.all([
        statsService.getMarketplace({}, { signal: controller.signal }).then(value => ({ value }), error => ({ error })),
        (async () => {
          const rows = [];
          for (let index = 0; index < storeIds.length && active; index += 4) {
            rows.push(...await Promise.all(storeIds.slice(index, index + 4).map(async id => {
              try { return [id, await statsService.getStore(id, { signal: controller.signal })]; }
              catch (error) { return [id, null, error]; }
            })));
          }
          return rows;
        })(),
      ]);
      if (!active) return;
      const storeStats = {}, storeErrors = {};
      for (const [id, stats, error] of rows) { if (stats) storeStats[id] = stats; else storeErrors[id] = error; }
      setResult({ key: requestKey, pending: false,
        marketplace: overviewResult.value ? marketplaceView(overviewResult.value) : null,
        marketplaceError: overviewResult.error || null, storeStats, storeErrors, demo: false });
    }
    load().catch(error => { if (active) setResult({ key: requestKey, pending: false, marketplace: null, marketplaceError: error, storeStats: {}, storeErrors: {}, demo: false }); });
    return () => { active = false; controller.abort(); };
  }, [requestKey, revision]);
  if (result.key !== requestKey) return { ...result, key: requestKey, pending: true, marketplace: null, storeStats: {}, demo: false, refresh };
  return { ...result, refresh };
}
