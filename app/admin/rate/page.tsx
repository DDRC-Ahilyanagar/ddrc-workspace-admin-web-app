'use client';

import { useEffect, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';

export default function RatePage() {
  const [rate, setRate] = useState<number>(10);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const resp = await fetch('/api/admin/rate', { cache: 'no-store' });
        const json = await resp.json();
        if (mounted && json?.ok) setRate(Number(json.rate || 10));
      } catch {}
      if (mounted) setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const resp = await fetch('/api/admin/rate', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rate })
      });
      const json = await resp.json();
      if (resp.ok && json?.ok) {
        setMessage('दर जतन केला');
      } else {
        setMessage(json?.error || 'त्रुटी');
      }
    } catch (e: any) {
      setMessage(e?.message || 'त्रुटी');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div className="container-fluid py-3">
        <h4 className="mb-3">क्षेत्र अधिकारी प्रति सर्वेक्षण दर</h4>
        {loading ? (
          <div className="text-muted">लोड होत आहे...</div>
        ) : (
          <form onSubmit={onSave} className="card p-3" style={{maxWidth: 480}}>
            <div className="mb-3">
              <label className="form-label">दर (₹)</label>
              <input
                type="number"
                className="form-control"
                min={0}
                step={1}
                value={Number.isFinite(rate) ? rate : 10}
                onChange={(e) => setRate(parseFloat(e.target.value || '0'))}
                required
              />
              <div className="form-text">हा दर डॅशबोर्डवरील वॉलेट गणनेसाठी वापरला जातो.</div>
            </div>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? 'जतन करत आहे...' : 'जतन करा'}
            </button>
            {message && <div className="mt-2 text-success">{message}</div>}
          </form>
        )}
      </div>
    </AdminLayout>
  );
}


