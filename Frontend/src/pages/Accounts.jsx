import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import PageHeader from '../components/PageHeader';

const Accounts = () => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // Creation State
  const [showCreateUi, setShowCreateUi] = useState(false);
  const [selectedType, setSelectedType] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');

  const fetchAccounts = useCallback(async () => {
    try {
      const response = await api.get('/accounts/me');
      if (response.data.success) {
        setAccounts(response.data.accounts.filter(a => a.account_type !== 'SYSTEM'));
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to retrieve accounts from ledger.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    if (isMounted) {
      fetchAccounts();
    }
    return () => { isMounted = false; };
  }, [fetchAccounts]);

  const handleCreateAccount = async () => {
    if (!selectedType) return;
    setIsSubmitting(true);
    setCreateError(null);
    setSuccessMsg('');

    try {
      const response = await api.post('/accounts', { account_type: selectedType });
      if (response.data.success) {
        const newAcc = response.data.account;
        setSuccessMsg(`ACCOUNT CREATED\n${newAcc.account_type} account •••• ${newAcc.account_id.toString().slice(-4).padStart(4, '0')} is now active.`);
        setShowCreateUi(false);
        setSelectedType('');
        await fetchAccounts();
        
        setTimeout(() => setSuccessMsg(''), 6000);
      }
    } catch (err) {
      setCreateError(err.response?.data?.error || 'SYSTEM ERROR\nUnable to create the account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <div className="animate-reveal-down font-mono text-muted" style={{ padding: 'var(--spacing-12) 0' }}>READING ACCOUNT REGISTER...</div>;
  }

  if (error) {
    return (
      <div className="animate-reveal-down">
        <PageHeader identifier="LC / 03" title="ACCOUNTS ERROR" />
        <div className="text-negative font-mono">{error}</div>
      </div>
    );
  }

  const activeAccounts = accounts.filter(a => a.status === 'ACTIVE');
  const combinedBalance = accounts.reduce((sum, acc) => sum + Number(acc.balance), 0);

  return (
    <div className="animate-reveal-down">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <PageHeader 
          identifier="LC / 03" 
          title="ACCOUNTS" 
          description="Manage and review your active financial accounts and liquidity endpoints." 
        />
        {!showCreateUi && (
          <button 
            className="btn-primary" 
            style={{ marginTop: 'var(--spacing-8)' }}
            onClick={() => setShowCreateUi(true)}
          >
            + OPEN ACCOUNT
          </button>
        )}
      </div>

      {successMsg && (
        <div className="surface animate-reveal-down font-mono" style={{ 
          marginBottom: 'var(--spacing-8)', 
          borderLeft: '4px solid var(--color-positive)',
          whiteSpace: 'pre-line'
        }}>
          {successMsg}
        </div>
      )}

      {showCreateUi && (
        <div className="surface animate-reveal-down" style={{ marginBottom: 'var(--spacing-8)', border: '1px solid var(--color-divider)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-6)' }}>
            <h3 style={{ margin: 0, fontSize: '1.25rem' }}>OPEN NEW ACCOUNT</h3>
            <button 
              className="meta-label" 
              onClick={() => {
                setShowCreateUi(false);
                setCreateError(null);
                setSelectedType('');
              }}
              style={{ color: 'var(--color-text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              [ CANCEL ]
            </button>
          </div>
          
          <div style={{ marginBottom: 'var(--spacing-6)' }}>
            <span className="meta-label" style={{ display: 'block', marginBottom: 'var(--spacing-3)' }}>ACCOUNT TYPE</span>
            <div style={{ display: 'flex', gap: 'var(--spacing-4)' }}>
              {['SAVINGS', 'CURRENT'].map(type => (
                <button
                  key={type}
                  className="font-mono"
                  style={{
                    padding: 'var(--spacing-3) var(--spacing-6)',
                    background: selectedType === type ? 'var(--color-text-primary)' : 'transparent',
                    color: selectedType === type ? 'var(--color-bg-primary)' : 'var(--color-text-primary)',
                    border: '1px solid var(--color-text-primary)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)'
                  }}
                  onClick={() => setSelectedType(type)}
                >
                  [ {type} ]
                </button>
              ))}
            </div>
          </div>

          {createError && (
            <div className="text-negative font-mono" style={{ marginBottom: 'var(--spacing-4)', whiteSpace: 'pre-line' }}>
              {createError}
            </div>
          )}

          <button 
            className="btn-primary" 
            disabled={!selectedType || isSubmitting}
            onClick={handleCreateAccount}
            style={{ opacity: (!selectedType || isSubmitting) ? 0.5 : 1 }}
          >
            {isSubmitting ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT'}
          </button>
        </div>
      )}

      {/* Account Summary Metrics */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
        gap: 'var(--spacing-6)', 
        marginBottom: 'var(--spacing-12)',
        borderTop: '1px solid var(--color-divider)',
        borderBottom: '1px solid var(--color-divider)',
        padding: 'var(--spacing-4) 0'
      }}>
        <div style={{ borderLeft: '1px solid var(--color-divider)', paddingLeft: 'var(--spacing-4)' }}>
          <span className="meta-label">Total Accounts</span>
          <div className="font-mono" style={{ fontSize: '1.25rem' }}>
            {accounts.length.toString().padStart(2, '0')}
          </div>
        </div>
        <div style={{ borderLeft: '1px solid var(--color-divider)', paddingLeft: 'var(--spacing-4)' }}>
          <span className="meta-label">Active Endpoints</span>
          <div className="font-mono" style={{ fontSize: '1.25rem' }}>
            {activeAccounts.length.toString().padStart(2, '0')}
          </div>
        </div>
        <div style={{ borderLeft: '1px solid var(--color-divider)', paddingLeft: 'var(--spacing-4)' }}>
          <span className="meta-label">Combined Balance</span>
          <div className="font-mono" style={{ fontSize: '1.25rem', color: 'var(--color-text-primary)' }}>
            ₹{(combinedBalance / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      <h3 style={{ fontSize: '1.25rem', marginBottom: 'var(--spacing-4)' }}>Account Register</h3>

      {accounts.length === 0 ? (
        <div className="surface text-muted" style={{ textAlign: 'center', padding: 'var(--spacing-12)' }}>
          <div className="font-mono" style={{ marginBottom: 'var(--spacing-4)' }}>NO ACCOUNTS</div>
          <p>No financial accounts are currently associated with this user.</p>
          {!showCreateUi && (
            <button 
              className="btn-primary" 
              style={{ marginTop: 'var(--spacing-6)' }}
              onClick={() => setShowCreateUi(true)}
            >
              + OPEN ACCOUNT
            </button>
          )}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="financial-table">
            <thead>
              <tr>
                <th>Account</th>
                <th>Type</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map(acc => (
                <tr 
                  key={acc.account_id} 
                  onClick={() => navigate(`/accounts/${acc.account_id}`)}
                  style={{ cursor: 'pointer', transition: 'background-color var(--transition-fast)' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-bg-surface)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <td className="font-mono">
                    •••• {acc.account_id.toString().slice(-4).padStart(4, '0')}
                  </td>
                  <td>{acc.account_type}</td>
                  <td style={{ 
                    color: acc.status === 'ACTIVE' ? 'var(--color-positive)' : 'var(--color-negative)',
                    fontWeight: 500
                  }}>
                    {acc.status}
                  </td>
                  <td className="numeric">
                    ₹{(Number(acc.balance) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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

export default Accounts;
