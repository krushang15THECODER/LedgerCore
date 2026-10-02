import React from 'react';

const PageHeader = ({ identifier, title, description }) => {
  return (
    <div className="animate-reveal-down" style={{ marginBottom: 'var(--spacing-8)' }}>
      <div className="lc-identifier" style={{ marginBottom: 'var(--spacing-4)' }}>
        {identifier}
      </div>
      <h2 style={{ fontSize: '2.5rem', marginBottom: 'var(--spacing-2)', letterSpacing: '0.02em' }}>
        {title}
      </h2>
      {description && (
        <p className="text-muted" style={{ fontSize: '1.125rem', maxWidth: '600px' }}>
          {description}
        </p>
      )}
      <hr className="hr-structural" style={{ marginTop: 'var(--spacing-6)', marginBottom: 0 }} />
    </div>
  );
};

export default PageHeader;
