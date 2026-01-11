'use client';

import React, { useEffect, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';

interface SignupLog {
  id: number;
  user_id: number | null;
  phone: string;
  user_name: string | null;
  step: string;
  step_number: number;
  status: 'started' | 'completed' | 'failed';
  data: any;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

interface LogsByPhone {
  phone: string;
  logs: SignupLog[];
  total_steps: number;
  completed_steps: number;
  failed_steps: number;
}

export default function SignupLogsPage() {
  const [logs, setLogs] = useState<SignupLog[]>([]);
  const [logsByPhone, setLogsByPhone] = useState<LogsByPhone[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [searchPhone, setSearchPhone] = useState('');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async (phone?: string) => {
    try {
      setLoading(true);
      const url = phone ? `/api/admin/signup-logs?phone=${encodeURIComponent(phone)}` : '/api/admin/signup-logs';
      const res = await fetch(url);
      const json = await res.json();

      if (json.ok) {
        setLogs(json.logs || []);
        setLogsByPhone(json.logs_by_phone || []);
      } else {
        console.error('Failed to fetch signup logs:', json.error);
        setLogs([]);
        setLogsByPhone([]);
      }
    } catch (error) {
      console.error('Error fetching signup logs:', error);
      setLogs([]);
      setLogsByPhone([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    if (searchPhone.trim()) {
      fetchLogs(searchPhone.trim());
      setSelectedPhone(searchPhone.trim());
    } else {
      fetchLogs();
      setSelectedPhone(null);
    }
  };

  const getStepName = (step: string): string => {
    const stepNames: Record<string, string> = {
      'selfie_uploaded': 'Step 1: Selfie Uploaded',
      'personal_info_entered': 'Step 2: Personal Info Entered',
      'otp_sent': 'Step 2: OTP Sent',
      'otp_verified': 'Step 3: OTP Verified',
      'territory_selected': 'Step 4: Territory Selected',
      'bank_details_saved': 'Step 5: Bank Details Saved',
      'profile_completed': 'Step 5: Profile Completed',
    };
    return stepNames[step] || step;
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { class: string; text: string }> = {
      'completed': { class: 'badge bg-success', text: 'Completed' },
      'started': { class: 'badge bg-warning', text: 'Started' },
      'failed': { class: 'badge bg-danger', text: 'Failed' },
    };
    const badge = badges[status] || { class: 'badge bg-secondary', text: status };
    return <span className={badge.class}>{badge.text}</span>;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <AdminLayout>
      <div className="container-fluid">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h1 className="h3 mb-0">Field Officer Signup Logs</h1>
          <button
            className="btn btn-primary"
            onClick={() => fetchLogs()}
            disabled={loading}
          >
            <i className="bi bi-arrow-clockwise me-2"></i>
            Refresh
          </button>
        </div>

        {/* Search */}
        <div className="card mb-4">
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-8">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search by phone number..."
                  value={searchPhone}
                  onChange={(e) => setSearchPhone(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <div className="col-md-4">
                <button
                  className="btn btn-outline-primary w-100"
                  onClick={handleSearch}
                >
                  <i className="bi bi-search me-2"></i>
                  Search
                </button>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-2 text-muted">Loading signup logs...</p>
          </div>
        ) : (
          <>
            {/* Summary by Phone */}
            {logsByPhone.length > 0 && (
              <div className="card mb-4">
                <div className="card-header">
                  <h5 className="mb-0">Signup Progress by Phone Number</h5>
                </div>
                <div className="card-body">
                  <div className="table-responsive">
                    <table className="table table-hover">
                      <thead>
                        <tr>
                          <th>Phone</th>
                          <th>User Name</th>
                          <th>Total Steps</th>
                          <th>Completed</th>
                          <th>Failed</th>
                          <th>Progress</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logsByPhone.map((group) => (
                          <tr key={group.phone}>
                            <td>{group.phone}</td>
                            <td>{group.logs[0]?.user_name || '-'}</td>
                            <td>{group.total_steps}</td>
                            <td>
                              <span className="badge bg-success">{group.completed_steps}</span>
                            </td>
                            <td>
                              <span className="badge bg-danger">{group.failed_steps}</span>
                            </td>
                            <td>
                              <div className="progress" style={{ height: '20px' }}>
                                <div
                                  className="progress-bar"
                                  role="progressbar"
                                  style={{
                                    width: `${(group.completed_steps / 5) * 100}%`,
                                  }}
                                >
                                  {Math.round((group.completed_steps / 5) * 100)}%
                                </div>
                              </div>
                            </td>
                            <td>
                              <button
                                className="btn btn-sm btn-outline-primary"
                                onClick={() => {
                                  setSelectedPhone(group.phone);
                                  fetchLogs(group.phone);
                                }}
                              >
                                View Details
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Detailed Logs */}
            <div className="card">
              <div className="card-header">
                <h5 className="mb-0">
                  {selectedPhone ? `Signup Logs for ${selectedPhone}` : 'All Signup Logs'}
                  {selectedPhone && (
                    <button
                      className="btn btn-sm btn-outline-secondary ms-2"
                      onClick={() => {
                        setSelectedPhone(null);
                        fetchLogs();
                      }}
                    >
                      Clear Filter
                    </button>
                  )}
                </h5>
              </div>
              <div className="card-body">
                {logs.length === 0 ? (
                  <div className="text-center py-5 text-muted">
                    No signup logs found.
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-striped">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Phone</th>
                          <th>User</th>
                          <th>Step</th>
                          <th>Status</th>
                          <th>Data</th>
                          <th>Error</th>
                          <th>Timestamp</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logs.map((log) => (
                          <tr key={log.id}>
                            <td>{log.id}</td>
                            <td>{log.phone}</td>
                            <td>
                              {log.user_name || '-'}
                              {log.user_id && (
                                <small className="text-muted d-block">ID: {log.user_id}</small>
                              )}
                            </td>
                            <td>
                              <strong>{getStepName(log.step)}</strong>
                              <small className="text-muted d-block">Step #{log.step_number}</small>
                            </td>
                            <td>{getStatusBadge(log.status)}</td>
                            <td>
                              {log.data ? (
                                <details>
                                  <summary className="text-primary" style={{ cursor: 'pointer' }}>
                                    View Data
                                  </summary>
                                  <pre className="mt-2 p-2 bg-light rounded" style={{ fontSize: '12px' }}>
                                    {JSON.stringify(log.data, null, 2)}
                                  </pre>
                                </details>
                              ) : (
                                '-'
                              )}
                            </td>
                            <td>
                              {log.error_message ? (
                                <span className="text-danger small">{log.error_message}</span>
                              ) : (
                                '-'
                              )}
                            </td>
                            <td>
                              <small>{formatDate(log.created_at)}</small>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
