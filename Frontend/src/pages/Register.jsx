import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';

const Register = () => {
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post('/auth/register', formData);
      if (response.data.success) {
        navigate('/login');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed.');
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: 'var(--color-bg-primary)' }}>
      <div className="surface" style={{ width: '100%', maxWidth: '400px' }}>
        <h1 style={{ textAlign: 'center', marginBottom: 'var(--spacing-6)' }}>Create Account</h1>
        
        {error && (
          <div style={{ color: 'var(--color-negative)', marginBottom: 'var(--spacing-4)', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
          <div>
            <label style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontSize: '0.875rem', fontWeight: 500 }}>Name</label>
            <input name="name" type="text" className="input-field" value={formData.name} onChange={handleChange} required />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontSize: '0.875rem', fontWeight: 500 }}>Email</label>
            <input name="email" type="email" className="input-field" value={formData.email} onChange={handleChange} required />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontSize: '0.875rem', fontWeight: 500 }}>Phone (Optional)</label>
            <input name="phone" type="tel" className="input-field" value={formData.phone} onChange={handleChange} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontSize: '0.875rem', fontWeight: 500 }}>Password</label>
            <input name="password" type="password" className="input-field" value={formData.password} onChange={handleChange} required minLength={6} />
          </div>
          
          <button type="submit" className="btn-primary" style={{ marginTop: 'var(--spacing-2)' }}>
            Register
          </button>
        </form>

        <div style={{ marginTop: 'var(--spacing-6)', textAlign: 'center', fontSize: '0.875rem' }}>
          Already have an account? <Link to="/login" style={{ fontWeight: 500, textDecoration: 'underline' }}>Sign In</Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
