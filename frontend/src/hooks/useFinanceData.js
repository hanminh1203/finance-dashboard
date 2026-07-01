import { useCallback, useEffect, useState } from 'react';
import { getTransactionData, getMetadata, getIncomeExpenseByMonth } from '../lib/sheetsApi';
import { normalizeRows } from '../lib/transform';

export function useFinanceData(token) {
  const [transactions, setTransactions] = useState([]);
  const [metadata, setMetadata] = useState({ sources: [], categories: [] });
  const [monthlySummary, setMonthlySummary] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [dataRes, metaRes, monthRes] = await Promise.all([
        getTransactionData(token),
        getMetadata(token),
        getIncomeExpenseByMonth(token),
      ]);
      setTransactions(normalizeRows(dataRes.rows));
      setMetadata(metaRes);
      setMonthlySummary(monthRes);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { transactions, metadata, monthlySummary, loading, error, refresh };
}