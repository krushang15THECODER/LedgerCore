import React, { useState } from 'react';
import api from '../services/api';
import PageHeader from '../components/PageHeader';

const XML_QUERIES = [
  {
    key: 'users',
    label: 'Query 1 — All Users',
    description: 'Display all data from the users table',
    endpoint: '/xml/users',
  },
  {
    key: 'totalAmount',
    label: 'Query 3 — Aggregate (SUM)',
    description: 'Total transaction amount using SUM aggregate',
    endpoint: '/xml/transactions/total-amount',
  },
  {
    key: 'accounts',
    label: 'Query 4 — Conditional Select',
    description: 'Accounts with balance >= specified minimum',
    endpoint: '/xml/accounts/balance',
    hasParam: true,
    paramLabel: 'Minimum Balance (paise)',
    paramDefault: '0',
  },
];

function formatXml(xml) {
  let formatted = '';
  let indent = 0;
  const tags = xml.replace(/>\s*</g, '><').split(/(<[^>]+>)/);
  tags.forEach((tag) => {
    if (!tag.trim()) return;
    if (tag.match(/^<\/\w/)) {
      indent--;
    }
    formatted += '  '.repeat(Math.max(indent, 0)) + tag + '\n';
    if (tag.match(/^<\w[^/]*[^/]>$/) && !tag.match(/^<\?/)) {
      indent++;
    }
  });
  return formatted.trim();
}

function highlightXml(xml) {
  return xml
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/(&lt;\/?)([\w-]+)(&gt;)/g, '$1<span style="color:#8b5e34;font-weight:600">$2</span>$3')
    .replace(/(&lt;\?[\w-]+)/g, '<span style="color:#6b7280">$1</span>')
    .replace(/(\?&gt;)/g, '<span style="color:#6b7280">$1</span>');
}

const XMLDemo = () => {
  const [selectedQuery, setSelectedQuery] = useState(XML_QUERIES[0].key);
  const [paramValue, setParamValue] = useState('0');
  const [xmlData, setXmlData] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [executionTime, setExecutionTime] = useState(null);

  const currentQuery = XML_QUERIES.find((q) => q.key === selectedQuery);

  const handleFetch = async () => {
    setLoading(true);
    setError(null);
    setXmlData('');
    setExecutionTime(null);

    try {
      let url = currentQuery.endpoint;
      if (currentQuery.hasParam) {
        url += `?min=${paramValue || 0}`;
      }

      const resp = await api.get(url, {
        responseType: 'text',
        headers: { Accept: 'application/xml' },
        transformResponse: [(data) => data],
      });

      const raw = resp.data;
      const timeMatch = raw.match(/<executionTime>(\d+ms)<\/executionTime>/);
      if (timeMatch) setExecutionTime(timeMatch[1]);

      const formatted = formatXml(raw);
      setXmlData(formatted);
    } catch (e) {
      console.error(e);
      setError(e.response?.data || 'Failed to fetch XML data. Check backend connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-reveal-down">
      <PageHeader
        identifier="LC / 06"
        title="XML DATA VIEW"
        description="Display query results in XML format — Queries 1, 3, and 4 (Section F)."
      />

      {/* Query Selector */}
      <div
        style={{
          borderTop: '1px solid var(--color-divider)',
          borderBottom: '1px solid var(--color-divider)',
          padding: 'var(--spacing-6) 0',
          marginBottom: 'var(--spacing-6)',
        }}
      >
        <span className="meta-label" style={{ display: 'block', marginBottom: 'var(--spacing-3)' }}>
          SELECT QUERY
        </span>

        <div style={{ display: 'flex', gap: 'var(--spacing-4)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <select
            value={selectedQuery}
            onChange={(e) => {
              setSelectedQuery(e.target.value);
              setXmlData('');
              setExecutionTime(null);
              setError(null);
            }}
            style={{
              padding: 'var(--spacing-3) var(--spacing-4)',
              border: '1px solid var(--color-divider)',
              background: 'var(--color-surface)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.875rem',
              color: 'var(--color-text-primary)',
              minWidth: '280px',
            }}
          >
            {XML_QUERIES.map((q) => (
              <option key={q.key} value={q.key}>
                {q.label}
              </option>
            ))}
          </select>

          {currentQuery.hasParam && (
            <input
              type="number"
              value={paramValue}
              onChange={(e) => setParamValue(e.target.value)}
              placeholder={currentQuery.paramLabel}
              style={{
                padding: 'var(--spacing-3) var(--spacing-4)',
                border: '1px solid var(--color-divider)',
                background: 'var(--color-surface)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.875rem',
                color: 'var(--color-text-primary)',
                width: '200px',
              }}
            />
          )}

          <button
            onClick={handleFetch}
            disabled={loading}
            style={{
              padding: 'var(--spacing-3) var(--spacing-6)',
              background: 'var(--color-text-primary)',
              color: 'var(--color-bg-primary)',
              border: 'none',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              cursor: loading ? 'wait' : 'pointer',
              fontWeight: 600,
            }}
          >
            {loading ? 'FETCHING...' : 'EXECUTE & FETCH XML'}
          </button>
        </div>

        <div className="font-mono text-muted" style={{ fontSize: '0.8rem', marginTop: 'var(--spacing-2)' }}>
          {currentQuery.description}
        </div>
      </div>

      {/* Execution Time Badge */}
      {executionTime && (
        <div
          style={{
            display: 'inline-block',
            padding: 'var(--spacing-2) var(--spacing-4)',
            border: '1px solid var(--color-divider)',
            marginBottom: 'var(--spacing-4)',
            fontSize: '0.8rem',
          }}
        >
          <span className="meta-label">EXECUTION TIME: </span>
          <span className="font-mono" style={{ color: 'var(--color-positive)', fontWeight: 600 }}>
            {executionTime}
          </span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          className="font-mono"
          style={{
            color: 'var(--color-negative)',
            padding: 'var(--spacing-4)',
            border: '1px solid var(--color-negative)',
            marginBottom: 'var(--spacing-4)',
            fontSize: '0.875rem',
          }}
        >
          ERR: {typeof error === 'string' ? error : JSON.stringify(error)}
        </div>
      )}

      {/* XML Output */}
      {xmlData && (
        <div
          className="surface"
          style={{
            border: '1px solid var(--color-divider)',
            padding: 0,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: 'var(--spacing-3) var(--spacing-4)',
              borderBottom: '1px solid var(--color-divider)',
              background: 'var(--color-bg-secondary)',
            }}
          >
            <span className="meta-label">XML OUTPUT</span>
            <span className="font-mono text-muted" style={{ fontSize: '0.75rem' }}>
              Content-Type: application/xml
            </span>
          </div>
          <pre
            style={{
              margin: 0,
              padding: 'var(--spacing-6)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8rem',
              lineHeight: 1.7,
              overflow: 'auto',
              maxHeight: '500px',
              background: 'var(--color-bg-primary)',
              color: 'var(--color-text-primary)',
              whiteSpace: 'pre',
            }}
            dangerouslySetInnerHTML={{ __html: highlightXml(xmlData) }}
          />
        </div>
      )}

      {/* Empty state */}
      {!xmlData && !loading && !error && (
        <div
          className="font-mono text-muted"
          style={{
            padding: 'var(--spacing-12) 0',
            textAlign: 'center',
            fontSize: '0.875rem',
          }}
        >
          Select a query and click "EXECUTE & FETCH XML" to view results in XML format.
        </div>
      )}
    </div>
  );
};

export default XMLDemo;
