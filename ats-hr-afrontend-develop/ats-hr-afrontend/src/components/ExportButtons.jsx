// src/components/ExportButtons.jsx
import React, { useState } from 'react';
import api from '../api/axios';

export default function ExportButtons({ data = [], filename = 'export', exportType = 'candidates', filters = {} }) {
  const [preparing, setPreparing] = useState(false);
  const [exportId, setExportId] = useState(null);
  const [password, setPassword] = useState('');
  const [finalizing, setFinalizing] = useState(false);

  const downloadCSV = () => {
    if (!data || !data.length) {
      alert('No data to export');
      return;
    }
    const keys = Array.from(data.reduce((acc, row) => {
      Object.keys(row || {}).forEach(k => acc.add(k));
      return acc;
    }, new Set()));

    const rows = data.map(row => keys.map(k => {
      const v = row[k];
      if (v === null || v === undefined) return '';
      const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
      return `"${s.replace(/"/g, '""')}"`;
    }).join(','));

    const csv = [keys.join(','), ...rows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const prepareExport = async () => {
    setPreparing(true);
    try {
      const res = await api.post('/v1/exports/prepare', { type: exportType, filters });
      setExportId(res.data.exportId);
      alert('Export prepared. Now enter a password and finalize to download.');
    } catch (err) {
      console.error(err);
      alert('Failed to prepare export');
    } finally {
      setPreparing(false);
    }
  };

  const finalizeExport = async () => {
    if (!exportId) return alert('Prepare first');
    if (!password) return alert('Enter a password');
    setFinalizing(true);
    try {
      const res = await api.post('/v1/exports/finalize', { exportId, password });
      const url = res.data.downloadUrl;
      window.location.href = url;
      setExportId(null);
      setPassword('');
    } catch (err) {
      console.error(err);
      alert('Failed to finalize export');
    } finally {
      setFinalizing(false);
    }
  };

  return (
    <div className="flex gap-2 items-center">
      <button onClick={downloadCSV} className="px-3 py-1 bg-blue-600 text-white rounded">Export CSV</button>
      <button onClick={prepareExport} className="px-3 py-1 border rounded" disabled={preparing}>
        {preparing ? 'Preparing...' : 'Prepare Protected Export'}
      </button>
      <input placeholder="password" value={password} onChange={(e) => setPassword(e.target.value)} className="border p-1 rounded text-sm" />
      <button onClick={finalizeExport} className="px-3 py-1 bg-green-600 text-white rounded" disabled={finalizing}>
        {finalizing ? 'Finalizing...' : 'Download (protected)'}
      </button>
    </div>
  );
}
