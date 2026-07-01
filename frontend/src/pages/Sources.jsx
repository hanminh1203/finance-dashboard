import { useMemo, useState } from 'react';
import Card from '../components/Card';
import SourceGrid from '../components/SourceGrid';
import TransactionList from '../components/TransactionList';
import { currentBalances, transactionsBySource } from '../lib/transform';

export default function Sources({ transactions, metadata }) {
  const balances = useMemo(() => currentBalances(transactions), [transactions]);
  const sourceTypes = useMemo(
    () => Object.fromEntries(metadata.sources.map((s) => [s.name, s.type])),
    [metadata.sources]
  );
  const [selected, setSelected] = useState(null);

  const sourceTx = useMemo(
    () => (selected ? transactionsBySource(transactions, selected) : []),
    [transactions, selected]
  );

  return (
    <div className="space-y-6">
      <Card title="Balances by Source">
        <SourceGrid balances={balances} sourceTypes={sourceTypes} onSelect={setSelected} selected={selected} />
      </Card>

      <Card title={selected ? `Transactions — ${selected}` : 'Select a source to view transactions'}>
        {selected ? (
          <TransactionList transactions={sourceTx} />
        ) : (
          <p className="text-text-muted text-sm py-8 text-center">Click a source above to see its history.</p>
        )}
      </Card>
    </div>
  );
}
