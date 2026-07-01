import { useCallback, useEffect, useState } from 'react';
import { getTransactionData, getMetadata } from '../lib/sheetsApi';
import { normalizeRows } from '../lib/transform';

export function useFinanceData(token) {
  const [transactions, setTransactions] = useState([]);
  const [metadata, setMetadata] = useState({ sources: [], categories: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [dataRes, metaRes] = await Promise.all([getTransactionData(token), getMetadata(token)]);
      setTransactions(normalizeRows(dataRes.rows));
      setMetadata(metaRes);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { transactions, metadata, loading, error, refresh };
}
