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
  const [copied, setCopied] = useState(false);

  // Operation State
  const [activeOperation, setActiveOperation] = useState(null); // 'DEPOSIT' | 'WITHDRAW' | 'TRANSFER'
  const [opAmount, setOpAmount] = useState('');
  const [opDestination, setOpDestination] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [opError, setOpError] = useState(null);
  const [opSuccess, setOpSuccess] = useState('');
  
  // Review State for Transfer
  const [isReviewing, setIsReviewing] = useState(false);

  const fetchAccountData = useCallback(async () => {
    try {
      const accRes = await api.get(`/accounts/${accountId}`);
      if (accRes.data.success) {
        setAccount(accRes.data.account);
      }
      
      try {
        const histRes = await api.get(`/transactions/account/${accountId}/history?limit=50`);
        if (histRes.data.success) {
          setHistory(histRes.data.history);
        }
      } catch (histErr) {
        console.warn("Backend history endpoint failed:", histErr.response?.data?.error);
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

  const openOperation = (type) => {
    setActiveOperation(type);
    setOpAmount('');
    setOpDestination('');
    setOpError(null);
    setOpSuccess('');
    setIsReviewing(false);
  };

  const closeOperation = () => {
    setActiveOperation(null);
    setOpError(null);
    setIsReviewing(false);
  };

  const handleReviewTransfer = () => {
    setOpError(null);
    const parsedAmount = parseFloat(opAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setOpError("Please enter a valid positive amount.");
      return;
    }
    const cleaned = opDestination.trim().replace(/^AC-?/i, '');
    const parsedDestId = parseInt(cleaned, 10);
    if (isNaN(parsedDestId) || parsedDestId <= 0) {
      setOpError("Please enter a valid recipient account ID (e.g. 2 or AC-0002).");
      return;
    }
    if (parsedDestId === Number(accountId)) {
      setOpError("Cannot transfer to the same account.");
      return;
    }
    setIsReviewing(true);
  };

  const handleOperationSubmit = async () => {
    setOpError(null);
    
    const parsedAmount = parseFloat(opAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setOpError("Please enter a valid positive amount.");
      return;
    }

    const amountInPaise = Math.round(parsedAmount * 100);
    const idempotencyKey = crypto.randomUUID(); 

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
        const cleaned = opDestination.trim().replace(/^AC-?/i, '');
        const parsedDestId = parseInt(cleaned, 10);
        response = await api.post('/transactions/transfer', { 
          from_account_id: accountId, 
          to_account_id: parsedDestId, 
          amount: amountInPaise 
        }, { headers });
      }

      if (response.data.success) {
        const refInfo = response.data.transaction?.reference_no ? `\nReference: ${response.data.transaction.reference_no}` : '';
        setOpSuccess(`${activeOperation === 'TRANSFER' ? 'TRANSFER COMPLETE' : 'TRANSACTION POSTED'}\n${activeOperation === 'TRANSFER' ? `₹${parsedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} transferred` : `Operation completed successfully.`}${refInfo}`);
        closeOperation();
        await fetchAccountData();
        setTimeout(() => setOpSuccess(''), 6000);
      }
    } catch (err) {
      let errorMsg = err.response?.data?.error || 'TRANSACTION FAILED\nThe operation could not be completed.';
      
      if (errorMsg === "One or both accounts do not exist." || errorMsg.includes("does not exist")) {
        errorMsg = "INVALID RECIPIENT\nThe destination account number you entered does not exist.";
      }
      
      setOpError(errorMsg);
      
      if (activeOperation === 'TRANSFER') {
        setIsReviewing(false);
      }
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

  const cleanedDest = opDestination.trim().replace(/^AC-?/i, '');
  const parsedDestId = parseInt(cleanedDest, 10);

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

      {/* Account Metrics Surface */}
      <div className="surface" style={{ marginBottom: 'var(--spacing-6)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-6)' }}>
        <div>
          <span className="meta-label">ACCOUNT NUMBER / ID</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--spacing-3)', marginTop: 'var(--spacing-1)' }}>
            <span className="font-mono" style={{ fontSize: '1.75rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              AC-{account.account_id.toString().padStart(4, '0')}
            </span>
            <button 
              onClick={() => {
                navigator.clipboard.writeText(account.account_id.toString());
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="meta-label"
              style={{
                background: 'transparent',
                border: '1px solid var(--color-divider)',
                padding: '2px 8px',
                cursor: 'pointer',
                color: copied ? 'var(--color-positive)' : 'var(--color-text-secondary)',
                fontSize: '0.75rem'
              }}
            >
              {copied ? '✓ COPIED' : 'COPY ID'}
            </button>
          </div>
          <div className="font-mono text-muted" style={{ fontSize: '0.8rem', marginTop: '4px' }}>
            Direct ID: <strong>{account.account_id}</strong>
          </div>
        </div>

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

      {/* Account ID Transfer Helper Banner */}
      <div style={{
        marginBottom: 'var(--spacing-8)',
        padding: 'var(--spacing-3) var(--spacing-4)',
        background: 'var(--color-bg-surface)',
        border: '1px solid var(--color-divider)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--spacing-3)'
      }}>
        <div>
          <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Account ID for Receiving Transfers:</span>{' '}
          <span className="font-mono" style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text-primary)', background: 'var(--color-bg-primary)', padding: '2px 8px', border: '1px solid var(--color-divider)' }}>
            {account.account_id}
          </span>
          <span className="text-muted" style={{ fontSize: '0.8125rem', marginLeft: 'var(--spacing-2)' }}>
            (or formatted as <code>AC-{account.account_id.toString().padStart(4, '0')}</code>)
          </span>
          <div className="text-muted" style={{ fontSize: '0.75rem', marginTop: '2px' }}>
            Provide this Account ID to other LedgerCore users when requesting money.
          </div>
        </div>
        <button
          onClick={() => {
            navigator.clipboard.writeText(account.account_id.toString());
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="meta-label"
          style={{
            background: 'var(--color-bg-primary)',
            border: '1px solid var(--color-divider)',
            padding: '6px 12px',
            cursor: 'pointer',
            fontSize: '0.75rem',
            color: copied ? 'var(--color-positive)' : 'var(--color-text-primary)'
          }}
        >
          {copied ? '✓ COPIED ACCOUNT ID' : 'COPY ACCOUNT ID'}
        </button>
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

      {activeOperation && !isReviewing && (
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
            <div style={{ padding: 'var(--spacing-4)', background: 'var(--color-bg-primary)', border: '1px solid var(--color-divider)' }}>
              <span className="meta-label" style={{ display: 'block', marginBottom: 'var(--spacing-2)' }}>
                {activeOperation === 'TRANSFER' ? 'FROM ACCOUNT' : 'ACCOUNT'}
              </span>
              <div className="font-mono">
                AC-{account.account_id.toString().padStart(4, '0')} (Account ID: {account.account_id}) — {account.account_type}
              </div>
            </div>

            {activeOperation === 'TRANSFER' && (
              <div>
                <span className="meta-label" style={{ display: 'block', marginBottom: 'var(--spacing-2)' }}>
                  RECIPIENT ACCOUNT NUMBER / ID
                </span>
                <input 
                  type="text"
                  placeholder="Enter recipient Account ID (e.g. 2 or AC-0002)"
                  maxLength={16}
                  value={opDestination} 
                  onChange={(e) => setOpDestination(e.target.value)}
                  className="font-mono"
                  style={{ 
                    width: '100%', 
                    padding: 'var(--spacing-3)', 
                    background: 'var(--color-bg-primary)', 
                    border: '1px solid var(--color-divider)',
                    color: 'var(--color-text-primary)'
                  }}
                />
                <span className="text-muted" style={{ display: 'block', fontSize: '0.75rem', marginTop: '4px' }}>
                  Enter the recipient's numeric Account ID (e.g., 2) or formatted account number (e.g., AC-0002)
                </span>
              </div>
            )}

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
            {activeOperation === 'TRANSFER' ? (
              <button 
                className="btn-primary" 
                disabled={!opAmount || !opDestination}
                onClick={handleReviewTransfer}
                style={{ opacity: (!opAmount || !opDestination) ? 0.5 : 1 }}
              >
                REVIEW TRANSFER
              </button>
            ) : (
              <button 
                className="btn-primary" 
                disabled={isSubmitting || !opAmount}
                onClick={handleOperationSubmit}
                style={{ opacity: (isSubmitting || !opAmount) ? 0.5 : 1 }}
              >
                {isSubmitting ? 'PROCESSING...' : `CONFIRM ${activeOperation}`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Transfer Review State */}
      {isReviewing && activeOperation === 'TRANSFER' && (
        <div className="surface animate-reveal-down" style={{ marginBottom: 'var(--spacing-12)', border: '1px solid var(--color-divider)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-6)' }}>
            <h3 style={{ margin: 0, fontSize: '1.25rem' }}>REVIEW TRANSFER</h3>
            <button 
              className="meta-label" 
              onClick={() => setIsReviewing(false)}
              style={{ color: 'var(--color-text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              [ CANCEL ]
            </button>
          </div>

          <div style={{ display: 'grid', gap: 'var(--spacing-6)', marginBottom: 'var(--spacing-8)' }}>
            <div>
              <span className="meta-label" style={{ display: 'block', marginBottom: 'var(--spacing-2)' }}>FROM</span>
              <div className="font-mono">AC-{account.account_id.toString().padStart(4, '0')} (Account ID: {account.account_id})</div>
            </div>
            <div>
              <span className="meta-label" style={{ display: 'block', marginBottom: 'var(--spacing-2)' }}>TO</span>
              <div className="font-mono">
                {!isNaN(parsedDestId) ? `AC-${parsedDestId.toString().padStart(4, '0')} (Account ID: ${parsedDestId})` : opDestination}
              </div>
            </div>
            <div>
              <span className="meta-label" style={{ display: 'block', marginBottom: 'var(--spacing-2)' }}>AMOUNT</span>
              <div className="font-serif" style={{ fontSize: '1.5rem' }}>
                ₹{parseFloat(opAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
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
              disabled={isSubmitting}
              onClick={handleOperationSubmit}
              style={{ opacity: isSubmitting ? 0.5 : 1 }}
            >
              {isSubmitting ? 'PROCESSING...' : 'CONFIRM TRANSFER'}
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
