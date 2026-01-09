'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';

interface Form {
  id: string;
  aadhaarId: string;
  aadharNo: string;
  holderName: string;
  questionsAnswered: number;
  questionsUnanswered?: number;
  createdAt: string | null;
  updatedAt: string | null;
}

interface Officer {
  id: string;
  name: string;
  phone: string;
  email: string;
  completedForms: number;
  incompleteForms: number;
  totalForms: number;
  completedFormsList: Form[];
  incompleteFormsList: Form[];
  lastLogin: string | null;
  walletBalance: string;
  createdAt: string | null;
}

export default function OfficersPage() {
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [loading, setLoading] = useState(true);
  const [ratePerSurvey, setRatePerSurvey] = useState(0);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchOfficers();
  }, []);

  const fetchOfficers = async () => {
    try {
      setLoading(true);
      console.log('Fetching officers from API...');
      const res = await fetch('/api/admin/officers');
      const json = await res.json();
      console.log('Officers API Response:', { 
        ok: json.ok, 
        dataCount: json.data?.length || 0, 
        ratePerSurvey: json.ratePerSurvey,
        error: json.error,
        sampleData: json.data?.[0] 
      });
      
      if (json.ok) {
        setOfficers(json.data || []);
        setRatePerSurvey(json.ratePerSurvey || 0);
        console.log('Officers set:', json.data?.length || 0, 'officers');
      } else {
        console.error('Officers API error:', json.error);
        setOfficers([]);
        setRatePerSurvey(0);
      }
    } catch (error) {
      console.error('Failed to fetch officers:', error);
      setOfficers([]);
      setRatePerSurvey(0);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const toggleRow = (officerId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(officerId)) {
      newExpanded.delete(officerId);
    } else {
      newExpanded.add(officerId);
    }
    setExpandedRows(newExpanded);
  };

  return (
    <AdminLayout>
      <div className="container-fluid">
        <div className="table-page-header d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4 gap-3 gap-md-0">
          <h1 className="h3 mb-0">Field Officers</h1>
          <button
            className="btn btn-primary w-100 w-md-auto"
            onClick={fetchOfficers}
            disabled={loading}
          >
            <i className="bi bi-arrow-clockwise me-2"></i>
            Refresh
          </button>
        </div>

        {ratePerSurvey > 0 && (
          <div className="alert alert-info mb-4">
            <i className="bi bi-info-circle me-2"></i>
            Rate per completed survey: ₹{ratePerSurvey.toFixed(2)}
          </div>
        )}

        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-2 text-muted">Loading officers...</p>
          </div>
        ) : officers.length === 0 ? (
          <div className="card">
            <div className="card-body text-center py-5">
              <i className="bi bi-person-x" style={{ fontSize: '3rem', color: '#ccc' }}></i>
              <p className="mt-3 text-muted">No field officers found</p>
              <p className="text-muted small">Please check:</p>
              <ul className="text-muted small text-start" style={{ maxWidth: '400px', margin: '0 auto' }}>
                <li>Database has users with <code>user_type = 'field_officer'</code></li>
                <li>Users have <code>is_active = 1</code></li>
                <li>Check browser console for API errors</li>
                <li>Check server logs for Prisma/database errors</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-hover mb-0">
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: '30px' }}></th>
                      <th>Officer Name</th>
                      <th>Contact</th>
                      <th>Completed Forms</th>
                      <th>Incomplete Forms</th>
                      <th>Total Forms</th>
                      <th>Wallet Balance</th>
                      <th>Last Login</th>
                    </tr>
                  </thead>
                  <tbody>
                    {officers.map((officer) => {
                      const isExpanded = expandedRows.has(officer.id);
                      return (
                        <React.Fragment key={officer.id}>
                          <tr>
                            <td>
                              <i
                                className={`bi bi-chevron-${isExpanded ? 'down' : 'right'}`}
                                style={{ fontSize: '0.8rem', cursor: 'pointer' }}
                                onClick={() => toggleRow(officer.id)}
                              ></i>
                            </td>
                            <td>
                              <Link 
                                href={`/officers/${officer.id}`}
                                style={{ textDecoration: 'none', color: 'inherit' }}
                              >
                                <strong 
                                  style={{ cursor: 'pointer', color: '#0d6efd' }}
                                  onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                                  onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                                >
                                  {officer.name}
                                </strong>
                              </Link>
                              {officer.email && (
                                <div className="text-muted small">{officer.email}</div>
                              )}
                            </td>
                            <td>{officer.phone}</td>
                            <td>
                              <span className="badge bg-success">
                                {officer.completedForms}
                              </span>
                            </td>
                            <td>
                              <span className="badge bg-warning text-dark">
                                {officer.incompleteForms}
                              </span>
                            </td>
                            <td>
                              <strong>{officer.totalForms}</strong>
                            </td>
                            <td>
                              <strong className="text-success">
                                ₹{parseFloat(officer.walletBalance).toLocaleString('en-IN', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </strong>
                            </td>
                            <td>
                              <small className="text-muted">
                                {formatDate(officer.lastLogin)}
                              </small>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr>
                              <td colSpan={8} className="p-0">
                                <div className="p-3 bg-light">
                                  <div className="row">
                                    <div className="col-md-6">
                                      <h6 className="mb-3">
                                        <i className="bi bi-check-circle-fill text-success me-2"></i>
                                        Completed Forms ({officer.completedFormsList.length})
                                      </h6>
                                      {officer.completedFormsList.length === 0 ? (
                                        <p className="text-muted small">No completed forms</p>
                                      ) : (
                                        <div className="table-responsive">
                                          <table className="table table-sm table-bordered">
                                            <thead>
                                              <tr>
                                                <th>Aadhaar No</th>
                                                <th>Holder Name</th>
                                                <th>Questions</th>
                                                <th>Completed At</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {officer.completedFormsList.map((form) => (
                                                <tr key={form.id}>
                                                  <td>{form.aadharNo}</td>
                                                  <td>{form.holderName}</td>
                                                  <td>{form.questionsAnswered}</td>
                                                  <td>
                                                    <small>{formatDate(form.updatedAt)}</small>
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      )}
                                    </div>
                                    <div className="col-md-6">
                                      <h6 className="mb-3">
                                        <i className="bi bi-clock-history text-warning me-2"></i>
                                        Incomplete Forms ({officer.incompleteFormsList.length})
                                      </h6>
                                      {officer.incompleteFormsList.length === 0 ? (
                                        <p className="text-muted small">No incomplete forms</p>
                                      ) : (
                                        <div className="table-responsive">
                                          <table className="table table-sm table-bordered">
                                            <thead>
                                              <tr>
                                                <th>Aadhaar No</th>
                                                <th>Holder Name</th>
                                                <th>Answered</th>
                                                <th>Remaining</th>
                                                <th>Last Updated</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {officer.incompleteFormsList.map((form) => (
                                                <tr key={form.id}>
                                                  <td>{form.aadharNo}</td>
                                                  <td>{form.holderName}</td>
                                                  <td>{form.questionsAnswered}</td>
                                                  <td>{form.questionsUnanswered || 0}</td>
                                                  <td>
                                                    <small>{formatDate(form.updatedAt)}</small>
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                  <tfoot className="table-light">
                    <tr>
                      <th></th>
                      <th>Total</th>
                      <th></th>
                      <th>
                        <span className="badge bg-success">
                          {officers.reduce((sum, o) => sum + o.completedForms, 0)}
                        </span>
                      </th>
                      <th>
                        <span className="badge bg-warning text-dark">
                          {officers.reduce((sum, o) => sum + o.incompleteForms, 0)}
                        </span>
                      </th>
                      <th>
                        <strong>
                          {officers.reduce((sum, o) => sum + o.totalForms, 0)}
                        </strong>
                      </th>
                      <th>
                        <strong className="text-success">
                          ₹{officers
                            .reduce((sum, o) => sum + parseFloat(o.walletBalance), 0)
                            .toLocaleString('en-IN', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                        </strong>
                      </th>
                      <th></th>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

