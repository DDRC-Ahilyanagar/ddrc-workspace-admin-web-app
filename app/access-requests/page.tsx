'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import AdminLayout from '@/components/AdminLayout';
import { getAbsoluteImageUrl } from '@/lib/config';

type AccessRequest = {
  id: number;
  name: string;
  phone: string;
  email?: string | null;
  selfie_url: string;
  user_type: string;
  status: 'pending' | 'approved' | 'declined';
  admin_note?: string | null;
  created_at: string;
  updated_at: string;
};

const STATUS_LABELS: Record<AccessRequest['status'], string> = {
  pending: 'प्रलंबित',
  approved: 'मंजूर केलेले',
  declined: 'नाकारलेले',
};

export default function AccessRequestsPage() {
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<AccessRequest['status']>('pending');
  const [noteMap, setNoteMap] = useState<Record<number, string>>({});
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const loadRequests = async () => {
    setLoading(true);
    setError('');
    try {
      console.log('Fetching access requests from API with status:', statusFilter);
      const res = await fetch(`/api/access-requests?status=${statusFilter}`, {
        cache: 'no-store',
        credentials: 'include',
      });
      console.log('Access Requests API Response Status:', res.status);
      const json = await res.json();
      console.log('Access Requests API Response:', {
        ok: json.ok,
        dataCount: json.data?.length || 0,
        error: json.error,
        status: res.status,
        sampleData: json.data?.[0]
      });

      if (json.ok) {
        setRequests(json.data || []);
        console.log('Access requests set:', json.data?.length || 0, 'requests');
      } else {
        const errorMsg = json.error || 'विनंत्या लोड होत नाहीत';
        console.error('Access Requests API error:', errorMsg);
        setError(errorMsg);
        setRequests([]);
      }
    } catch (err: any) {
      console.error('Failed to fetch access requests:', err);
      setError('नेटवर्क त्रुटी: ' + (err.message || 'Unknown error'));
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const handleStatusUpdate = async (id: number, status: 'approved' | 'declined') => {
    const note = noteMap[id]?.trim() || null;
    try {
      const res = await fetch(`/api/access-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status, admin_note: note }),
      });
      const json = await res.json();
      if (json.ok) {
        await loadRequests();
      } else {
        setError(json.error || 'स्थिती अद्ययावत करता आली नाही');
      }
    } catch (err: any) {
      setError('नेटवर्क त्रुटी');
    }
  };

  const filters = useMemo(
    () => [
      { value: 'pending', label: 'प्रलंबित' },
      { value: 'approved', label: 'मंजूर केलेले' },
      { value: 'declined', label: 'नाकारलेले' },
    ],
    []
  );

  return (
    <AdminLayout>
      <div className="container-fluid">
        <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-md-between gap-3 mb-4 animate__animated animate__fadeInDown">
          <h1 className="title mb-0">प्रवेश विनंत्या</h1>
          <div className="btn-group" role="group" aria-label="Status filter">
            {filters.map(filter => (
              <button
                key={filter.value}
                type="button"
                className={`btn ${statusFilter === filter.value ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={() => setStatusFilter(filter.value as AccessRequest['status'])}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="alert alert-danger animate__animated animate__fadeIn" role="alert">
            {error}
          </div>
        )}

        <div className="card shadow-sm animate__animated animate__fadeInUp">
          <div className="card-body">
            <div className="table-page-header d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-3 gap-2 gap-md-0">
              <h5 className="card-title mb-0">एकूण विनंत्या: {requests.length}</h5>
              <button className="btn btn-outline-secondary btn-sm w-100 w-md-auto" onClick={loadRequests} disabled={loading}>
                {loading ? 'रिफ्रेश होत आहे...' : 'रिफ्रेश'}
              </button>
            </div>

            <div className="table-responsive">
              <table className="table table-hover align-middle">
                <thead className="table-light">
                  <tr>
                    <th>नाव</th>
                    <th>मोबाईल क्रमांक</th>
                    <th>वापरकर्ता प्रकार</th>
                    <th>सेल्फी</th>
                    <th>स्थिती</th>
                    <th>विनंती वेळ</th>
                    <th style={{ minWidth: '220px' }}>टिप / कृती</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.length === 0 && !loading && (
                    <tr>
                      <td colSpan={7} className="text-center py-4 text-muted">
                        विनंत्या उपलब्ध नाहीत
                      </td>
                    </tr>
                  )}

                  {loading && (
                    <tr>
                      <td colSpan={7} className="text-center py-4">
                        <div className="spinner-border text-primary" role="status">
                          <span className="visually-hidden">लोड होत आहे...</span>
                        </div>
                      </td>
                    </tr>
                  )}

                  {requests.map(request => (
                    <tr key={request.id} className="animate__animated animate__fadeInUp">
                      <td>
                        <div className="fw-semibold">{request.name}</div>
                        <small className="text-muted">#{request.id}</small>
                        {request.email && <small className="text-muted d-block">{request.email}</small>}
                      </td>
                      <td>{request.phone}</td>
                      <td>
                        <span className={`badge ${request.user_type === 'VERIFICATION_OFFICER' ? 'bg-info' : 'bg-primary'}`}>
                          {request.user_type === 'VERIFICATION_OFFICER' ? 'पडताळणी अधिकारी' : 'क्षेत्रीय अधिकारी'}
                        </span>
                      </td>
                      <td>
                        {request.selfie_url ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-info"
                            onClick={() => setPreviewUrl(getAbsoluteImageUrl(request.selfie_url))}
                          >
                            पाहा
                          </button>
                        ) : (
                          <span className="text-muted small">उपलब्ध नाही</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge bg-${request.status === 'approved' ? 'success' : request.status === 'declined' ? 'danger' : 'warning'} text-uppercase`}>
                          {STATUS_LABELS[request.status]}
                        </span>
                      </td>
                      <td>
                        <div>{new Date(request.created_at).toLocaleString('mr-IN')}</div>
                        <small className="text-muted">अपडेट: {new Date(request.updated_at).toLocaleString('mr-IN')}</small>
                      </td>
                      <td>
                        <div className="d-flex flex-column gap-2">
                          <textarea
                            className="form-control col-12 mb-3"
                            rows={2}
                            placeholder="टीप लिहा"
                            value={noteMap[request.id] ?? request.admin_note ?? ''}
                            onChange={(e) =>
                              setNoteMap(prev => ({
                                ...prev,
                                [request.id]: e.target.value,
                              }))
                            }
                          />
                          <div className="d-flex gap-2">
                            <button
                              className="btn btn-success btn-sm flex-fill"
                              onClick={() => handleStatusUpdate(request.id, 'approved')}
                              disabled={loading}
                            >
                              मंजूर
                            </button>
                            <button
                              className="btn btn-danger btn-sm flex-fill"
                              onClick={() => handleStatusUpdate(request.id, 'declined')}
                              disabled={loading}
                            >
                              नाकारा
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      {previewUrl && typeof window !== 'undefined' && createPortal(
        <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.7)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">सेल्फी पूर्वावलोकन</h5>
                <button type="button" className="btn-close" onClick={() => setPreviewUrl(null)}></button>
              </div>
              <div className="modal-body text-center">
                <img src={previewUrl ? getAbsoluteImageUrl(previewUrl) : ''} alt="Selfie" className="img-fluid" style={{ maxHeight: '70vh', objectFit: 'contain' }} />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setPreviewUrl(null)}>
                  बंद करा
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </AdminLayout>
  );
}


