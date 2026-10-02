import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import PageHeader from '../components/PageHeader';

const TransactionDetail = () => {
  const { txnId } = useParams();
  const navigate = useNavigate();
  const [transaction, setTransaction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchTransaction = async () => {
      try {
        const response = await api.get(`/transactions/${txnId}`);
        if (isMounted && response.data.success) {
          setTransaction(response.data.transaction);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.response?.data?.error || 'TRANSACTION UNAVAILABLE\nThe requested transaction could not be retrieved.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchTransaction();
    return () => { isMounted = false; };
  }, [txnId]);

  if (loading) {
    return <div className="animate-reveal-down font-mono text-muted" style={{ padding: 'var(--spacing-12) 0' }}>READING TRANSACTION...</div>;
  }

  if (error || !transaction) {
    return (
      <div className="animate-reveal-down">
        <PageHeader identifier="LC / 05" title="SYSTEM ERROR" />
        <div className="text-negative font-mono" style={{ whiteSpace: 'pre-line' }}>{error || 'Transaction not found.'}</div>
        <button onClick={() => navigate('/transactions')} className="btn-primary" style={{ marginTop: 'var(--spacing-6)' }}>Return to Register</button>
      </div>
    );
  }

  const entries = transaction.ledger_entries || [];
  const totalDebit = entries.filter(e => e.entry_type === 'DEBIT').reduce((sum, e) => sum + Number(e.amount), 0);
  const totalCredit = entries.filter(e => e.entry_type === 'CREDIT').reduce((sum, e) => sum + Number(e.amount), 0);
  const isBalanced = totalDebit === totalCredit && totalDebit > 0;

  // Assuming symmetric entries for single amount transactions (e.g. 1 debit, 1 credit of same amount)
  const transactionAmount = totalDebit; 

  return (
    <div className="animate-reveal-down">
      <button 
        onClick={() => navigate('/transactions')} 
        style={{ marginBottom: 'var(--spacing-8)', color: 'var(--color-text-secondary)', fontSize: '0.875rem', letterSpacing: '0.05em', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        ← BACK TO TRANSACTIONS
      </button>

      <PageHeader 
        identifier="LC / 05" 
        title="TRANSACTION DETAIL"
        description="Detailed breakdown of a posted financial operation and its double-entry accounting records."
      />

      <div className="surface" style={{ marginBottom: 'var(--spacing-8)' }}>
        <h3 style={{ fontSize: '1.25rem', marginBottom: 'var(--spacing-4)', 
          color: transaction.txn_type === 'DEPOSIT' ? 'var(--color-positive)' : 
                 transaction.txn_type === 'WITHDRAWAL' ? 'var(--color-negative)' : 'var(--color-text-primary)'
        }}>
          {transaction.txn_type} • {transaction.status}
        </h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-8)', marginBottom: 'var(--spacing-6)' }}>
          <div>
            <span className="meta-label">Reference</span>
            <div className="font-mono">{transaction.reference_no}</div>
          </div>
          <div>
            <span className="meta-label">Created</span>
            <div className="font-mono">{new Date(transaction.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).toUpperCase()}</div>
          </div>
        </div>
        
        <hr style={{ borderColor: 'var(--color-divider)', margin: 'var(--spacing-6) 0' }} />
        
        <h4 style={{ fontSize: '1rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Transaction Summary</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-4)', marginTop: 'var(--spacing-4)' }}>
          <div>
            <span className="meta-label">Type</span>
            <div>{transaction.txn_type}</div>
          </div>
          {transactionAmount > 0 && (
            <div>
              <span className="meta-label">Amount</span>
              <div className="font-serif" style={{ fontSize: '2rem' }}>
                ₹{(transactionAmount / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
          )}
          {transaction.description && (
            <div style={{ gridColumn: '1 / -1' }}>
              <span className="meta-label">Description</span>
              <div>{transaction.description}</div>
            </div>
          )}
        </div>
      </div>

      {entries.length > 0 && (
        <>
          <h3 style={{ fontSize: '1.25rem', marginBottom: 'var(--spacing-4)' }}>Ledger Entries</h3>
          <div className="surface" style={{ padding: 0, overflowX: 'auto', marginBottom: 'var(--spacing-8)' }}>
            <table className="financial-table" style={{ border: 'none', margin: 0 }}>
              <thead>
                <tr>
                  <th style={{ paddingLeft: 'var(--spacing-6)' }}>Account</th>
                  <th>Entry</th>
                  <th style={{ textAlign: 'right', paddingRight: 'var(--spacing-6)' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(entry => {
                  // If it's the system account, we assume it's identified by account_id 1 (or we can just show the ID).
                  // The API returns account_id. We mask it just like other accounts, but if it's the known SYSTEM ID, we can display SYSTEM_CASH.
                  // Since we don't have the account_type here (only account_id), we'll display AC-XXXX.
                  return (
                    <tr key={entry.entry_id}>
                      <td className="font-mono" style={{ paddingLeft: 'var(--spacing-6)' }}>
                        •••• {entry.account_id.toString().slice(-4).padStart(4, '0')}
                      </td>
                      <td style={{ color: entry.entry_type === 'CREDIT' ? 'var(--color-positive)' : 'inherit' }}>
                        {entry.entry_type}
                      </td>
                      <td className="numeric" style={{ paddingRight: 'var(--spacing-6)' }}>
                        {entry.entry_type === 'CREDIT' ? '+' : '-'}₹{(Number(entry.amount) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            
            <div style={{ padding: 'var(--spacing-6)', borderTop: '1px solid var(--color-divider)', background: 'var(--color-bg-primary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--spacing-2)' }}>
                <span className="meta-label">TOTAL DEBIT</span>
                <span className="font-mono">₹{(totalDebit / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--spacing-4)' }}>
                <span className="meta-label">TOTAL CREDIT</span>
                <span className="font-mono">₹{(totalCredit / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 'var(--spacing-4)', borderTop: '1px solid var(--color-divider)' }}>
                <span className="meta-label">ACCOUNTING STATUS</span>
                <span className="font-mono" style={{ 
                  color: isBalanced ? 'var(--color-positive)' : 'var(--color-negative)',
                  fontWeight: 500,
                  border: `1px solid ${isBalanced ? 'var(--color-positive)' : 'var(--color-negative)'}`,
                  padding: '2px 8px'
                }}>
                  {isBalanced ? 'BALANCED' : 'UNBALANCED'}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default TransactionDetail;
