import React, { useEffect, useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { AuthContext } from '../contexts/AuthContext';
import PageHeader from '../components/PageHeader';

const Dashboard = () => {
  const { user } = useContext(AuthContext);
  const [dashboardData, setDashboardData] = useState(null);
  const [accountsData, setAccountsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        const [dashRes, accRes] = await Promise.all([
          api.get('/dashboard'),
          api.get('/accounts/me')
        ]);

        if (isMounted) {
          if (dashRes.data.success) {
            setDashboardData(dashRes.data.dashboard);
          }
          if (accRes.data.success) {
            // Ensure SYSTEM_CASH is never shown as a user account
            const userAccounts = accRes.data.accounts.filter(acc => acc.account_type !== 'SYSTEM');
            setAccountsData(userAccounts);
          }
        }
      } catch (err) {
        if (isMounted) {
          setError('Failed to retrieve financial data. Please verify your connection or re-authenticate.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();
    return () => { isMounted = false; };
  }, []);

  if (loading) {
    return (
      <div className="animate-reveal-down font-mono text-muted" style={{ padding: 'var(--spacing-12) 0' }}>
        INITIALIZING LEDGER TERMINAL...
      </div>
    );
  }

  if (error) {
    return (
      <div className="animate-reveal-down">
        <PageHeader identifier="LC / 02" title="SYSTEM ERROR" />
        <div className="text-negative font-mono">{error}</div>
      </div>
    );
  }

  return (
    <div className="animate-reveal-down">
      <PageHeader 
        identifier="LC / 02" 
        title="OVERVIEW" 
        description="A consolidated view of your accounts and recorded financial activity."
      />

      <div style={{ marginBottom: 'var(--spacing-8)' }}>
        <span className="meta-label">TOTAL ACCOUNT BALANCE</span>
        <div className="font-serif" style={{ fontSize: 'clamp(2.5rem, 4vw, 3.5rem)', color: 'var(--color-text-primary)', lineHeight: 1.1 }}>
          ₹{(dashboardData.total_balance / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      </div>
      
      {/* Summary Metrics */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
        gap: 'var(--spacing-6)', 
        marginBottom: 'var(--spacing-8)',
        borderTop: '1px solid var(--color-divider)',
        borderBottom: '1px solid var(--color-divider)',
        padding: 'var(--spacing-4) 0'
      }}>
        <div style={{ borderLeft: '1px solid var(--color-divider)', paddingLeft: 'var(--spacing-4)' }}>
          <span className="meta-label">Total Accounts</span>
          <div className="font-mono" style={{ fontSize: '1.25rem' }}>
            {dashboardData.total_accounts.toString().padStart(2, '0')}
          </div>
        </div>
        <div style={{ borderLeft: '1px solid var(--color-divider)', paddingLeft: 'var(--spacing-4)' }}>
          <span className="meta-label">Active Endpoints</span>
          <div className="font-mono" style={{ fontSize: '1.25rem' }}>
            {accountsData.filter(a => a.status === 'ACTIVE').length.toString().padStart(2, '0')}
          </div>
        </div>
        <div style={{ borderLeft: '1px solid var(--color-divider)', paddingLeft: 'var(--spacing-4)' }}>
          <span className="meta-label">Total Operations</span>
          <div className="font-mono" style={{ fontSize: '1.25rem' }}>
            {dashboardData.total_transactions.toString().padStart(3, '0')}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--spacing-8)', alignItems: 'start' }}>
        
        {/* Account Summary */}
        <div className="surface" style={{ padding: 'var(--spacing-6)', border: '1px solid var(--color-divider)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 'var(--spacing-6)' }}>
            <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Active Endpoints</h3>
            <Link to="/accounts" className="meta-label" style={{ color: 'var(--color-text-primary)' }}>VIEW ALL</Link>
          </div>

          {accountsData.length === 0 ? (
            <div className="text-muted font-mono" style={{ borderTop: '1px solid var(--color-divider)', padding: 'var(--spacing-4) 0', fontSize: '0.875rem' }}>
              No active accounts found on ledger.
            </div>
          ) : (
            <div style={{ borderTop: '1px solid var(--color-divider)' }}>
              {accountsData.slice(0, 5).map(acc => (
                <div key={acc.account_id} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  padding: 'var(--spacing-4) 0',
                  borderBottom: '1px solid var(--color-divider)'
                }}>
                  <div>
                    <div className="font-mono" style={{ fontSize: '0.875rem' }}>
                      AC-{acc.account_id.toString().padStart(4, '0')}
                    </div>
                    <div className="meta-label" style={{ marginTop: '0.25rem', color: acc.status === 'ACTIVE' ? 'var(--color-positive)' : 'var(--color-text-secondary)' }}>
                      {acc.account_type} • {acc.status}
                    </div>
                  </div>
                  <div className="font-mono" style={{ fontSize: '1.125rem' }}>
                    ₹{(Number(acc.balance) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Transactions */}
        <div className="surface" style={{ padding: 'var(--spacing-6)', border: '1px solid var(--color-divider)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 'var(--spacing-6)' }}>
            <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Recent Operations</h3>
            <Link to="/transactions" className="meta-label" style={{ color: 'var(--color-text-primary)' }}>VIEW ALL</Link>
          </div>

          {dashboardData.recent_transactions.length === 0 ? (
            <div className="text-muted font-mono" style={{ borderTop: '1px solid var(--color-divider)', padding: 'var(--spacing-4) 0', fontSize: '0.875rem' }}>
              No operations recorded on ledger.
            </div>
          ) : (
            <div style={{ borderTop: '1px solid var(--color-divider)' }}>
              {dashboardData.recent_transactions.map(txn => (
                <div key={txn.txn_id} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'flex-start',
                  padding: 'var(--spacing-4) 0',
                  borderBottom: '1px solid var(--color-divider)'
                }}>
                  <div>
                    <div className="font-mono" style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                      {new Date(txn.created_at).toISOString().replace('T', ' ').substring(0, 16)}
                    </div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 500, marginTop: '0.25rem' }}>
                      {txn.txn_type} <span className="font-mono text-muted" style={{ fontSize: '0.75rem', marginLeft: '0.25rem' }}>#{txn.reference_no}</span>
                    </div>
                  </div>
                  <div className="font-mono" style={{ 
                    fontSize: '0.875rem', 
                    textAlign: 'right',
                    color: txn.status === 'COMPLETED' ? 'var(--color-positive)' : 
                           txn.status === 'FAILED' ? 'var(--color-negative)' : 'var(--color-text-secondary)'
                  }}>
                    {txn.status}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
