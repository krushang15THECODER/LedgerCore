import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import PageHeader from '../components/PageHeader';

const Transactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;
    const fetchTransactions = async () => {
      try {
        const response = await api.get('/transactions');
        if (isMounted && response.data.success) {
          setTransactions(response.data.transactions);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.response?.data?.error || 'Failed to retrieve transactions from ledger.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchTransactions();
    return () => { isMounted = false; };
  }, []);

  if (loading) {
    return <div className="animate-reveal-down font-mono text-muted" style={{ padding: 'var(--spacing-12) 0' }}>READING TRANSACTION REGISTER...</div>;
  }

  if (error) {
    return (
      <div className="animate-reveal-down">
        <PageHeader identifier="LC / 04" title="SYSTEM ERROR" />
        <div className="text-negative font-mono">{error}</div>
      </div>
    );
  }

  return (
    <div className="animate-reveal-down">
      <PageHeader 
        identifier="LC / 04" 
        title="TRANSACTIONS" 
        description="Review posted financial activity across your accounts." 
      />

      <h3 style={{ fontSize: '1.25rem', marginBottom: 'var(--spacing-4)' }}>Transaction Register</h3>

      {transactions.length === 0 ? (
        <div className="surface text-muted" style={{ textAlign: 'center', padding: 'var(--spacing-12)' }}>
          <div className="font-mono" style={{ marginBottom: 'var(--spacing-4)' }}>NO TRANSACTIONS</div>
          <p>No financial activity has been recorded for this user.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="financial-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Date</th>
                <th>Type</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(txn => (
                <tr 
                  key={txn.txn_id} 
                  onClick={() => navigate(`/transactions/${txn.txn_id}`)}
                  style={{ cursor: 'pointer', transition: 'background-color var(--transition-fast)' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-bg-surface)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <td className="font-mono">
                    {txn.reference_no}
                  </td>
                  <td className="font-mono text-muted" style={{ fontSize: '0.875rem' }}>
                    {new Date(txn.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}
                  </td>
                  <td style={{ 
                    color: txn.txn_type === 'DEPOSIT' ? 'var(--color-positive)' : 
                           txn.txn_type === 'WITHDRAWAL' ? 'var(--color-negative)' : 'var(--color-text-primary)'
                  }}>
                    {txn.txn_type}
                  </td>
                  <td style={{ fontWeight: 500 }}>
                    {txn.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Transactions;
