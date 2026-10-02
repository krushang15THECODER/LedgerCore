import React, { useEffect, useState, useContext } from 'react';
import api from '../services/api';
import { AuthContext } from '../contexts/AuthContext';

const Dashboard = () => {
  const { user } = useContext(AuthContext);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const response = await api.get('/dashboard');
        if (response.data.success) {
          setData(response.data.dashboard);
        }
      } catch (err) {
        setError('Failed to load dashboard data.');
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  if (loading) return <div>Loading dashboard...</div>;
  if (error) return <div style={{ color: 'var(--color-negative)' }}>{error}</div>;

  return (
    <div>
      <h2 style={{ marginBottom: 'var(--spacing-6)' }}>Welcome, {user?.name}</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 'var(--spacing-6)', marginBottom: 'var(--spacing-8)' }}>
        <div className="surface">
          <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-2)' }}>Total Balance</div>
          <div className="mono" style={{ fontSize: '2rem', color: 'var(--color-positive)' }}>
            ₹{(data.total_balance / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>
        
        <div className="surface">
          <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-2)' }}>Active Accounts</div>
          <div className="mono" style={{ fontSize: '2rem' }}>{data.total_accounts}</div>
        </div>

        <div className="surface">
          <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-2)' }}>Total Transactions</div>
          <div className="mono" style={{ fontSize: '2rem' }}>{data.total_transactions}</div>
        </div>
      </div>
      
      <h3>Recent Transactions</h3>
      <div className="surface" style={{ padding: 0, overflow: 'hidden' }}>
        {data.recent_transactions.length === 0 ? (
          <div style={{ padding: 'var(--spacing-6)', color: 'var(--color-text-secondary)' }}>No recent transactions.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-primary)' }}>
                <th style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 500, fontSize: '0.875rem' }}>Date</th>
                <th style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 500, fontSize: '0.875rem' }}>Ref</th>
                <th style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 500, fontSize: '0.875rem' }}>Type</th>
                <th style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 500, fontSize: '0.875rem' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.recent_transactions.map(txn => (
                <tr key={txn.txn_id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td className="mono" style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontSize: '0.875rem' }}>
                    {new Date(txn.created_at).toLocaleDateString()}
                  </td>
                  <td className="mono" style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontSize: '0.875rem' }}>{txn.reference_no}</td>
                  <td style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontSize: '0.875rem' }}>{txn.txn_type}</td>
                  <td style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontSize: '0.875rem' }}>{txn.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
