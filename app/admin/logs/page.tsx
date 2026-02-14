'use client';

import React, { useEffect, useState, useRef } from 'react';
import AdminLayout from '@/components/AdminLayout';

export default function SystemLogsPage() {
    const [logs, setLogs] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [userPhone, setUserPhone] = useState<string>('');
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeSource, setActiveSource] = useState<'admin' | 'api' | 'python'>('admin');
    const logEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const phone = localStorage.getItem('user_phone') || '';
        setUserPhone(phone);
        if (phone === '7768068585') {
            fetchLogs();
        } else {
            setLoading(false);
            setError('Access restricted to system developer.');
        }
    }, [activeSource]);

    useEffect(() => {
        if (autoRefresh && userPhone === '7768068585') {
            const interval = setInterval(fetchLogs, 3000);
            return () => clearInterval(interval);
        }
    }, [autoRefresh, userPhone, activeSource]);

    const fetchLogs = async () => {
        try {
            const res = await fetch(`/api/admin/logs?source=${activeSource}`);
            const json = await res.json();
            if (json.ok) {
                setLogs(json.logs || []);
                setError(null);
            } else {
                setError(json.error || 'Failed to fetch logs');
            }
        } catch (err) {
            setError('Network error: Failed to fetch logs');
        } finally {
            setLoading(false);
        }
    };

    const filteredLogs = searchQuery
        ? logs.filter(log => log.toLowerCase().includes(searchQuery.toLowerCase()))
        : logs;

    if (userPhone && userPhone !== '7768068585') {
        return (
            <AdminLayout>
                <div className="container py-5">
                    <div className="alert alert-danger shadow-sm">
                        <i className="bi bi-exclamation-triangle-fill me-2"></i>
                        Access restricted. You do not have permission to view system logs.
                    </div>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="container-fluid px-4 py-3">
                <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3">
                    <div>
                        <h1 className="h3 mb-0 fw-bold text-dark">
                            <i className="bi bi-terminal-fill me-2 text-primary"></i>
                            System Logs (Live)
                        </h1>
                        <p className="text-muted small mb-0">Direct server-side API activity monitoring</p>
                    </div>

                    <div className="d-flex align-items-center gap-3">
                        <div className="btn-group shadow-sm">
                            <button
                                className={`btn btn-sm ${activeSource === 'admin' ? 'btn-primary' : 'btn-outline-primary'}`}
                                onClick={() => setActiveSource('admin')}
                            >
                                Admin Web
                            </button>
                            <button
                                className={`btn btn-sm ${activeSource === 'api' ? 'btn-primary' : 'btn-outline-primary'}`}
                                onClick={() => setActiveSource('api')}
                            >
                                DDRC API
                            </button>
                            <button
                                className={`btn btn-sm ${activeSource === 'python' ? 'btn-primary' : 'btn-outline-primary'}`}
                                onClick={() => setActiveSource('python')}
                            >
                                Python Media
                            </button>
                        </div>

                        <div className="d-flex align-items-center gap-3 bg-white p-2 rounded shadow-sm border">
                            <div className="form-check form-switch mb-0">
                                <input
                                    className="form-check-input"
                                    type="checkbox"
                                    id="autoRefreshSwitch"
                                    checked={autoRefresh}
                                    onChange={(e) => setAutoRefresh(e.target.checked)}
                                />
                                <label className="form-check-label small fw-bold" htmlFor="autoRefreshSwitch">
                                    Auto Refresh
                                </label>
                            </div>

                            <div className="vr"></div>

                            <button
                                className="btn btn-sm btn-light border"
                                onClick={fetchLogs}
                                disabled={loading}
                            >
                                <i className={`bi bi-arrow-clockwise ${loading ? 'animate-spin' : ''}`}></i>
                            </button>

                            <input
                                type="text"
                                className="form-control form-control-sm"
                                placeholder="Search logs..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{ width: '200px' }}
                            />
                        </div>
                    </div>
                </div>

                {error && <div className="alert alert-danger shadow-sm border-0 border-start border-danger border-4">{error}</div>}

                <div
                    className="card bg-dark text-light shadow-lg border-0"
                    style={{
                        height: 'calc(100vh - 200px)',
                        borderRadius: '12px',
                        overflow: 'hidden'
                    }}
                >
                    <div className="card-header bg-black bg-opacity-25 py-2 px-3 border-bottom border-secondary d-flex justify-content-between align-items-center">
                        <div className="d-flex gap-1">
                            <div className="rounded-circle bg-danger" style={{ width: '12px', height: '12px' }}></div>
                            <div className="rounded-circle bg-warning" style={{ width: '12px', height: '12px' }}></div>
                            <div className="rounded-circle bg-success" style={{ width: '12px', height: '12px' }}></div>
                        </div>
                        <small className="text-secondary fw-monospace">
                            {activeSource === 'admin' ? 'sadmin.ddrcnagar.in :: ddrc_api.log' :
                                activeSource === 'api' ? 'surveyapi.ddrcnagar.in :: logs' :
                                    'surveymediapython.ddrcnagar.in :: media_service.log'}
                        </small>
                    </div>

                    <div className="card-body p-0" style={{ overflowY: 'auto' }}>
                        {loading && logs.length === 0 ? (
                            <div className="h-100 d-flex flex-column align-items-center justify-content-center text-secondary">
                                <div className="spinner-border spinner-border-sm mb-3" role="status"></div>
                                <span>Establishing connection to log stream...</span>
                            </div>
                        ) : (
                            <div className="p-3 fw-monospace" style={{ fontSize: '13px', lineHeight: '1.6' }}>
                                {filteredLogs.map((log, idx) => {
                                    const isError = log.includes('ERROR:');
                                    const isWarn = log.includes('WARN:');
                                    const isInfo = log.includes('INFO:');

                                    let color = '#d1d1d1'; // Muted white
                                    let bg = 'transparent';

                                    if (isError) {
                                        color = '#ff6b6b';
                                        bg = 'rgba(255, 107, 107, 0.05)';
                                    }
                                    else if (isWarn) {
                                        color = '#ffd93d';
                                        bg = 'rgba(255, 217, 61, 0.05)';
                                    }
                                    else if (isInfo) {
                                        color = '#6bcbff';
                                        bg = 'rgba(107, 203, 255, 0.05)';
                                    }

                                    return (
                                        <div
                                            key={idx}
                                            className="log-line px-2 py-1"
                                            style={{
                                                color,
                                                backgroundColor: bg,
                                                whiteSpace: 'pre-wrap',
                                                wordBreak: 'break-all',
                                                borderLeft: isError ? '3px solid #ff6b6b' : isWarn ? '3px solid #ffd93d' : isInfo ? '3px solid #6bcbff' : '3px solid transparent'
                                            }}
                                        >
                                            <span className="text-secondary me-2">[{idx + 1}]</span>
                                            {log}
                                        </div>
                                    );
                                })}
                                {filteredLogs.length === 0 && (
                                    <div className="text-center py-5 text-secondary">
                                        <i className="bi bi-search d-block mb-2 h4"></i>
                                        {searchQuery ? 'No logs matching your search.' : 'The log file is empty.'}
                                    </div>
                                )}
                                <div ref={logEndRef} />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <style jsx>{`
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .log-line:hover {
          background-color: rgba(255, 255, 255, 0.03) !important;
        }
        .fw-monospace {
          font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
        }
      `}</style>
        </AdminLayout>
    );
}
