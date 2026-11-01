// utils/toXml.js
// Helper to convert an array of objects to XML elements

function singularize(name) {
  // Simple singularization for common cases
  if (name.endsWith('s') && !name.endsWith('ss')) return name.slice(0, -1);
  return name + '_item';
}

export function buildXml(rootName, rows) {
  if (!Array.isArray(rows)) rows = [rows];
  const tagName = singularize(rootName);
  let xml = '';
  rows.forEach(row => {
    xml += `<${tagName}>`;
    for (const [key, value] of Object.entries(row)) {
      const val = value === null || value === undefined ? '' : String(value);
      const escaped = val
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
      xml += `<${key}>${escaped}</${key}>`;
    }
    xml += `</${tagName}>`;
  });
  return xml;
}
