import { useCallback, useEffect, useState } from 'react';
import { getTransactionData, getMetadata, getIncomeExpenseByMonth } from '../lib/api';
import { normalizeRows } from '../lib/transform';

export function useFinanceData(signedIn) {
  const [transactions, setTransactions] = useState([]);
  const [metadata, setMetadata] = useState({ sources: [], categories: [] });
  const [monthlySummary, setMonthlySummary] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [listVersion, setListVersion] = useState(0);

  const refresh = useCallback(async () => {
    if (!signedIn) return;
    setLoading(true);
    setError(null);
    try {
      const [dataRes, metaRes, monthRes] = await Promise.all([
        getTransactionData(),
        getMetadata(),
        getIncomeExpenseByMonth(),
      ]);
      setTransactions(normalizeRows(dataRes.rows, metaRes.categories));
      setMetadata(metaRes);
      setMonthlySummary(monthRes);
      setListVersion((v) => v + 1);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }, [signedIn]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { transactions, metadata, monthlySummary, loading, error, refresh, listVersion };
}
