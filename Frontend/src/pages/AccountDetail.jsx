import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import PageHeader from '../components/PageHeader';

const AccountDetail = () => {
  const { accountId } = useParams();
  const navigate = useNavigate();
  const [account, setAccount] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Operation State
  const [activeOperation, setActiveOperation] = useState(null); // 'DEPOSIT' | 'WITHDRAW' | 'TRANSFER'
  const [opAmount, setOpAmount] = useState('');
  const [opDestination, setOpDestination] = useState('');
  const [eligibleAccounts, setEligibleAccounts] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [opError, setOpError] = useState(null);
  const [opSuccess, setOpSuccess] = useState('');

  const fetchAccountData = useCallback(async () => {
    try {
      // Fetch account details independently
      const accRes = await api.get(`/accounts/${accountId}`);
      if (accRes.data.success) {
        setAccount(accRes.data.account);
      }
      
      // Attempt to fetch history independently so a backend SQL error doesn't crash the whole page
      try {
        const histRes = await api.get(`/transactions/account/${accountId}/history?limit=50`);
        if (histRes.data.success) {
          setHistory(histRes.data.history);
        }
      } catch (histErr) {
        console.warn("Backend history endpoint failed:", histErr.response?.data?.error);
        // We do not set the main page error, we just leave history empty
      }
      
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to retrieve account details.');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    let isMounted = true;
    if (isMounted) fetchAccountData();
    return () => { isMounted = false; };
  }, [fetchAccountData]);

  const loadEligibleAccounts = async () => {
    try {
      const response = await api.get('/accounts/me');
      if (response.data.success) {
        setEligibleAccounts(
          response.data.accounts.filter(a => a.account_type !== 'SYSTEM' && a.account_id !== Number(accountId) && a.status === 'ACTIVE')
        );
      }
    } catch (err) {
      console.error("Failed to load destination accounts.");
    }
  };

  const openOperation = (type) => {
    setActiveOperation(type);
    setOpAmount('');
    setOpDestination('');
    setOpError(null);
    setOpSuccess('');
    if (type === 'TRANSFER') {
      loadEligibleAccounts();
    }
  };

  const closeOperation = () => {
    setActiveOperation(null);
    setOpError(null);
  };

  const handleOperationSubmit = async () => {
    setOpError(null);
    
    // Basic frontend validation
    const parsedAmount = parseFloat(opAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setOpError("Please enter a valid positive amount.");
      return;
    }
    
    if (activeOperation === 'TRANSFER' && !opDestination) {
      setOpError("Please select a valid destination account.");
      return;
    }

    const amountInPaise = Math.round(parsedAmount * 100);
    const idempotencyKey = crypto.randomUUID(); // Prevent duplicate submissions

    setIsSubmitting(true);
    setOpSuccess('');

    try {
      let response;
      const headers = { 'Idempotency-Key': idempotencyKey };

      if (activeOperation === 'DEPOSIT') {
        response = await api.post('/transactions/deposit', { account_id: accountId, amount: amountInPaise }, { headers });
      } else if (activeOperation === 'WITHDRAW') {
        response = await api.post('/transactions/withdraw', { account_id: accountId, amount: amountInPaise }, { headers });
      } else if (activeOperation === 'TRANSFER') {
        response = await api.post('/transactions/transfer', { 
          from_account_id: accountId, 
          to_account_id: opDestination, 
          amount: amountInPaise 
        }, { headers });
      }

      if (response.data.success) {
        setOpSuccess(`TRANSACTION POSTED\n${activeOperation} of ₹${parsedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} completed successfully.`);
        closeOperation();
        await fetchAccountData();
        setTimeout(() => setOpSuccess(''), 6000);
      }
    } catch (err) {
      setOpError(err.response?.data?.error || 'TRANSACTION FAILED\nThe operation could not be completed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <div className="animate-reveal-down font-mono text-muted" style={{ padding: 'var(--spacing-12) 0' }}>READING ACCOUNT LEDGER...</div>;
  }

  if (error || !account) {
    return (
      <div className="animate-reveal-down">
        <PageHeader identifier="LC / 03.1" title="ACCOUNT ERROR" />
        <div className="text-negative font-mono">{error || 'Account not found.'}</div>
        <button onClick={() => navigate('/accounts')} className="btn-primary" style={{ marginTop: 'var(--spacing-6)' }}>Return to Register</button>
      </div>
    );
  }

  return (
    <div className="animate-reveal-down">
      <button 
        onClick={() => navigate('/accounts')} 
        style={{ marginBottom: 'var(--spacing-8)', color: 'var(--color-text-secondary)', fontSize: '0.875rem', letterSpacing: '0.05em', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        ← RETURN TO REGISTER
      </button>

      <PageHeader 
        identifier={`LC / AC-${account.account_id.toString().padStart(4, '0')}`} 
        title={`${account.account_type} ACCOUNT`}
        description={`Detailed view and operational history for account endpoint.`}
      />

      <div className="surface" style={{ marginBottom: 'var(--spacing-8)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-8)' }}>
        <div>
          <span className="meta-label">CURRENT BALANCE</span>
          <div className="font-serif" style={{ fontSize: '2.5rem', lineHeight: 1.1, color: 'var(--color-text-primary)' }}>
            ₹{(Number(account.balance) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div>
          <span className="meta-label">ACCOUNT STATUS</span>
          <div className="font-mono" style={{ 
            fontSize: '1.25rem', 
            color: account.status === 'ACTIVE' ? 'var(--color-positive)' : 'var(--color-negative)'
          }}>
            {account.status}
          </div>
        </div>
        <div>
          <span className="meta-label">ESTABLISHED</span>
          <div className="font-mono" style={{ fontSize: '1.125rem' }}>
            {new Date(account.created_at).toLocaleDateString('en-IN')}
          </div>
        </div>
      </div>

      {opSuccess && (
        <div className="surface animate-reveal-down font-mono" style={{ 
          marginBottom: 'var(--spacing-8)', 
          borderLeft: '4px solid var(--color-positive)',
          whiteSpace: 'pre-line'
        }}>
          {opSuccess}
        </div>
      )}

      {/* Operations Panel */}
      {account.status === 'ACTIVE' && !activeOperation && (
        <div style={{ display: 'flex', gap: 'var(--spacing-4)', marginBottom: 'var(--spacing-12)' }}>
          <button className="btn-primary" onClick={() => openOperation('DEPOSIT')}>[ DEPOSIT ]</button>
          <button className="btn-primary" style={{ background: 'transparent', color: 'var(--color-text-primary)', border: '1px solid var(--color-text-primary)' }} onClick={() => openOperation('WITHDRAW')}>[ WITHDRAW ]</button>
          <button className="btn-primary" style={{ background: 'transparent', color: 'var(--color-text-primary)', border: '1px solid var(--color-text-primary)' }} onClick={() => openOperation('TRANSFER')}>[ TRANSFER ]</button>
        </div>
      )}

      {activeOperation && (
        <div className="surface animate-reveal-down" style={{ marginBottom: 'var(--spacing-12)', border: '1px solid var(--color-divider)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-6)' }}>
            <h3 style={{ margin: 0, fontSize: '1.25rem' }}>{activeOperation} FUNDS</h3>
            <button 
              className="meta-label" 
              onClick={closeOperation}
              style={{ color: 'var(--color-text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              [ CANCEL ]
            </button>
          </div>

          <div style={{ display: 'grid', gap: 'var(--spacing-6)', marginBottom: 'var(--spacing-8)' }}>
            {/* Context Display */}
            <div style={{ padding: 'var(--spacing-4)', background: 'var(--color-bg-primary)', border: '1px solid var(--color-divider)' }}>
              <span className="meta-label" style={{ display: 'block', marginBottom: 'var(--spacing-2)' }}>
                {activeOperation === 'TRANSFER' ? 'FROM ACCOUNT' : 'ACCOUNT'}
              </span>
              <div className="font-mono">
                •••• {account.account_id.toString().slice(-4).padStart(4, '0')} — {account.account_type}
              </div>
            </div>

            {/* Transfer Destination */}
            {activeOperation === 'TRANSFER' && (
              <div>
                <span className="meta-label" style={{ display: 'block', marginBottom: 'var(--spacing-2)' }}>TO ACCOUNT</span>
                <select 
                  className="font-mono"
                  value={opDestination} 
                  onChange={(e) => setOpDestination(e.target.value)}
                  style={{ 
                    width: '100%', 
                    padding: 'var(--spacing-3)', 
                    background: 'var(--color-bg-primary)', 
                    border: '1px solid var(--color-divider)',
                    color: 'var(--color-text-primary)'
                  }}
                >
                  <option value="">-- Select Destination Endpoint --</option>
                  {eligibleAccounts.map(a => (
                    <option key={a.account_id} value={a.account_id}>
                      •••• {a.account_id.toString().slice(-4).padStart(4, '0')} ({a.account_type})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Amount Input */}
            <div>
              <span className="meta-label" style={{ display: 'block', marginBottom: 'var(--spacing-2)' }}>AMOUNT (₹)</span>
              <input 
                type="number" 
                step="0.01"
                min="1"
                placeholder="0.00"
                value={opAmount}
                onChange={(e) => setOpAmount(e.target.value)}
                className="font-mono"
                style={{ 
                  width: '100%', 
                  padding: 'var(--spacing-3)', 
                  background: 'var(--color-bg-primary)', 
                  border: '1px solid var(--color-divider)',
                  color: 'var(--color-text-primary)',
                  fontSize: '1.25rem'
                }}
              />
            </div>
          </div>

          {opError && (
            <div className="text-negative font-mono" style={{ marginBottom: 'var(--spacing-6)', whiteSpace: 'pre-line', padding: 'var(--spacing-4)', borderLeft: '4px solid var(--color-negative)', background: 'var(--color-bg-primary)' }}>
              {opError}
            </div>
          )}

          <div style={{ display: 'flex', gap: 'var(--spacing-4)' }}>
            <button 
              className="btn-primary" 
              disabled={isSubmitting || !opAmount || (activeOperation === 'TRANSFER' && !opDestination)}
              onClick={handleOperationSubmit}
              style={{ opacity: (isSubmitting || !opAmount || (activeOperation === 'TRANSFER' && !opDestination)) ? 0.5 : 1 }}
            >
              {isSubmitting ? 'PROCESSING...' : `CONFIRM ${activeOperation}`}
            </button>
          </div>
        </div>
      )}

      <h3 style={{ fontSize: '1.25rem', marginBottom: 'var(--spacing-4)' }}>Transaction History</h3>

      {history.length === 0 ? (
        <div className="text-muted font-mono" style={{ borderTop: '1px solid var(--color-divider)', padding: 'var(--spacing-4) 0' }}>
          No historical operations recorded for this account.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="financial-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Reference</th>
                <th>Operation</th>
                <th>Entry</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {history.map((record) => (
                <tr 
                  key={record.entry_id}
                  onClick={() => navigate(`/transactions/${record.txn_id}`)}
                  style={{ cursor: 'pointer', transition: 'background-color var(--transition-fast)' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-bg-surface)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <td className="numeric text-muted">
                    {new Date(record.created_at).toISOString().replace('T', ' ').substring(0, 16)}
                  </td>
                  <td className="numeric">{record.reference_no}</td>
                  <td>{record.txn_type}</td>
                  <td style={{ color: record.entry_type === 'CREDIT' ? 'var(--color-positive)' : 'inherit' }}>
                    {record.entry_type}
                  </td>
                  <td className="numeric">
                    {record.entry_type === 'CREDIT' ? '+' : '-'}₹{(Number(record.amount) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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

export default AccountDetail;
