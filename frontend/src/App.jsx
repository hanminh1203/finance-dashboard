import { useMemo, useState } from 'react';
import NavBar from './components/NavBar';
import SignInScreen from './components/SignInScreen';
import Dashboard from './pages/Dashboard';
import Sources from './pages/Sources';
import Health from './pages/Health';
import Management from './pages/Management';
import AddTransactionForm from './components/AddTransactionForm';
import ReceiptForm from './components/ReceiptForm';
import TransferForm from './components/TransferForm';
import { useAuth } from './hooks/useAuth';
import { useFinanceData } from './hooks/useFinanceData';
import { currentBalances } from './lib/transform';
import ChatBot from './components/ChatBot';

export default function App() {
  const { signedIn, ready, error: authError, signIn, signOut } = useAuth();
  const { transactions, metadata, monthlySummary, loading, error, refresh } = useFinanceData(signedIn);
  const [tab, setTab] = useState('dashboard');
  const balances = useMemo(() => currentBalances(transactions), [transactions]);

  if (!signedIn) {
    return <SignInScreen onSignIn={signIn} error={authError} ready={ready} />;
  }

  return (
    <div className="min-h-screen bg-bg">
      <NavBar active={tab} onChange={setTab} onRefresh={refresh} refreshing={loading} onSignOut={signOut} />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {error && (
          <div className="mb-6 p-4 rounded-lg border border-expense/40 bg-expense/10 text-expense text-sm">
            Failed to load data: {error}
            {error.toLowerCase().includes('permission') && (
              <> — make sure this Google account has at least Viewer access to the spreadsheet.</>
            )}
          </div>
        )}

        {loading && transactions.length === 0 && tab !== 'health' && tab !== 'management' ? (
          <LoadingState />
        ) : (
          <>
            {tab === 'dashboard' && <Dashboard transactions={transactions} monthlySummary={monthlySummary} />}
            {tab === 'sources' && <Sources transactions={transactions} metadata={metadata} />}
            {tab === 'health' && <Health />}
            {tab === 'management' && <Management />}
            {tab === 'add' && (
              <div className="flex justify-center">
                <AddTransactionForm metadata={metadata} onSaved={refresh} />
              </div>
            )}
            {tab === 'receipt' && (
              <div className="flex justify-center">
                <ReceiptForm metadata={metadata} onSaved={refresh} />
              </div>
            )}
            {tab === 'transfer' && (
              <div className="flex justify-center">
                <TransferForm metadata={metadata} balances={balances} onSaved={refresh} />
              </div>
            )}
            {tab === 'chat' && (
              <ChatBot metadata={metadata} onSaved={refresh} />
            )}
          </>
        )}
      </main>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-24 rounded-xl bg-bg-surface border border-bg-border animate-pulse" />
      ))}
      <div className="sm:col-span-3 h-80 rounded-xl bg-bg-surface border border-bg-border animate-pulse" />
    </div>
  );
}
