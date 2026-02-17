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
        let interval: NodeJS.Timeout;
        if (autoRefresh && userPhone === '7768068585') {
            interval = setInterval(fetchLogs, 3000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
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
                    <div className="alert alert-danger shadow-sm border-0 rounded-4 p-4">
                        <div className="d-flex align-items-center">
                            <i className="bi bi-shield-lock-fill h1 me-4 text-danger mb-0"></i>
                            <div>
                                <h4 className="fw-bold mb-1">Access Restricted</h4>
                                <p className="mb-0 opacity-75">You do not have the required permissions to access this diagnostic tool.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="container-fluid px-4 py-4 min-vh-100 bg-light bg-opacity-50">
                <div className="row mb-5 align-items-center">
                    <div className="col">
                        <div className="d-flex align-items-center gap-3">
                            <div className="bg-primary bg-gradient rounded-3 p-3 shadow-lg shadow-primary-50">
                                <i className="bi bi-terminal h3 text-white mb-0"></i>
                            </div>
                            <div>
                                <h1 className="h3 mb-1 fw-black text-dark tracking-tight">System Monitor <span className="badge bg-danger ms-2 pulse-slow px-2 py-1" style={{ fontSize: '10px' }}>LIVE</span></h1>
                                <p className="text-secondary small mb-0 fw-medium">Real-time log streaming from core services</p>
                            </div>
                        </div>
                    </div>

                    <div className="col-auto">
                        <div className="glass-card p-2 d-flex align-items-center gap-2">
                            <div className="source-selector btn-group p-1 bg-dark bg-opacity-10 rounded-pill">
                                {(['admin', 'api', 'python'] as const).map(source => (
                                    <button
                                        key={source}
                                        onClick={() => setActiveSource(source)}
                                        className={`btn btn-sm rounded-pill px-3 py-2 fw-bold transition-all ${activeSource === source ? 'btn-primary shadow-sm' : 'text-secondary hover-bg-light'}`}
                                    >
                                        {source === 'admin' ? 'Web Console' : source === 'api' ? 'DDRC API' : 'Python Media'}
                                    </button>
                                ))}
                            </div>

                            <div className="vr mx-2 opacity-10"></div>

                            <div className="d-flex align-items-center gap-3 px-2">
                                <div className="form-check form-switch mb-0">
                                    <input
                                        className="form-check-input custom-switch"
                                        type="checkbox"
                                        id="autoRefreshSwitch"
                                        checked={autoRefresh}
                                        onChange={(e) => setAutoRefresh(e.target.checked)}
                                    />
                                    <label className="form-check-label small fw-bold text-secondary" htmlFor="autoRefreshSwitch">
                                        Auto-Sync
                                    </label>
                                </div>

                                <button
                                    className="btn btn-icon btn-light rounded-circle border-0 shadow-sm"
                                    onClick={fetchLogs}
                                    disabled={loading}
                                    title="Manual Refresh"
                                >
                                    <i className={`bi bi-arrow-clockwise h5 mb-0 ${loading ? 'animate-spin d-inline-block' : ''}`}></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="row">
                    <div className="col-12">
                        {error && (
                            <div className="alert alert-danger border-0 shadow-lg rounded-4 p-3 mb-4 d-flex align-items-center">
                                <i className="bi bi-info-circle-fill h4 me-3 mb-0"></i>
                                <span>{error}</span>
                            </div>
                        )}

                        <div className="terminal-container shadow-2xl rounded-4 overflow-hidden border border-white border-opacity-10">
                            <div className="terminal-header d-flex align-items-center justify-content-between px-4 py-3 bg-dark border-bottom border-white border-opacity-5">
                                <div className="d-flex gap-2">
                                    <div className="control-dot bg-danger"></div>
                                    <div className="control-dot bg-warning"></div>
                                    <div className="control-dot bg-success"></div>
                                    <span className="ms-3 text-secondary x-small fw-monospace opacity-50">root@ddrc-server:~$ tail -f {activeSource}.log</span>
                                </div>
                                <div className="d-flex align-items-center gap-3">
                                    <div className="search-box position-relative">
                                        <i className="bi bi-search position-absolute start-0 top-50 translate-middle-y ms-3 text-secondary"></i>
                                        <input
                                            type="text"
                                            className="form-control form-control-sm terminal-search ps-5 border-0 bg-white bg-opacity-5 text-white"
                                            placeholder="Grep data..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                    </div>
                                    <div className="status-indicator d-flex align-items-center gap-2">
                                        <div className="pulse-green"></div>
                                        <span className="x-small text-success fw-bold">SOCKET_ESTABLISHED</span>
                                    </div>
                                </div>
                            </div>

                            <div className="terminal-body p-0 bg-dark position-relative">
                                <div className="scroll-container px-4 py-4" style={{ height: 'calc(100vh - 320px)', width: '100%', overflowY: 'auto' }}>
                                    {loading && logs.length === 0 ? (
                                        <div className="h-100 d-flex flex-column align-items-center justify-content-center">
                                            <div className="loader-orbit mb-4">
                                                <div className="orbit-dot"></div>
                                            </div>
                                            <span className="text-secondary fw-monospace animate-pulse">Initializing log stream...</span>
                                        </div>
                                    ) : (
                                        <div className="log-stream fw-monospace" style={{ fontSize: '13px', letterSpacing: '0.02em' }}>
                                            {filteredLogs.map((log, idx) => {
                                                const isError = log.toLowerCase().includes('error:');
                                                const isWarn = log.toLowerCase().includes('warn:');
                                                const isInfo = log.toLowerCase().includes('info:');

                                                let statusClass = 'status-default';
                                                if (isError) statusClass = 'status-error';
                                                else if (isWarn) statusClass = 'status-warn';
                                                else if (isInfo) statusClass = 'status-info';

                                                // Try to extract JSON
                                                let prefix = log;
                                                let jsonPart = '';
                                                let prettyJson = null;

                                                if (log.includes(' -> ')) {
                                                    const parts = log.split(' -> ');
                                                    prefix = parts[0] + ' -> ';
                                                    jsonPart = parts.slice(1).join(' -> ');
                                                    try {
                                                        const parsed = JSON.parse(jsonPart);
                                                        prettyJson = JSON.stringify(parsed, null, 2);
                                                    } catch (e) {
                                                        prettyJson = null;
                                                    }
                                                }

                                                return (
                                                    <div key={idx} className={`log-entry ${statusClass} mb-2`}>
                                                        <div className="log-header d-flex align-items-start gap-3 py-1 px-2">
                                                            <span className="line-number text-secondary opacity-25 user-select-none" style={{ minWidth: '35px' }}>{idx + 1}</span>
                                                            <span className="log-prefix">{prefix}</span>
                                                            {!prettyJson && <span className="log-content">{jsonPart}</span>}
                                                        </div>
                                                        {prettyJson && (
                                                            <div className="json-block mt-1 ms-5 p-3 rounded bg-black bg-opacity-40 border border-white border-opacity-5">
                                                                <pre className="mb-0 text-white-50" style={{ fontSize: '12px' }}>
                                                                    {prettyJson.split('\n').map((line, lidx) => (
                                                                        <div key={lidx}>
                                                                            {line.split(/(:|{|}|\[|\]|,)/).map((segment, sidx) => {
                                                                                if (segment === ':') return <span key={sidx} className="token-punctuation">:</span>;
                                                                                if (/[{}\[\]]/.test(segment)) return <span key={sidx} className="token-bracket">{segment}</span>;
                                                                                if (segment === ',') return <span key={sidx} className="token-punctuation">,</span>;
                                                                                if (segment.includes('"')) {
                                                                                    // Key or String Value
                                                                                    const isKey = line.split(':')[0].includes(segment);
                                                                                    return <span key={sidx} className={isKey ? 'token-key' : 'token-string'}>{segment}</span>;
                                                                                }
                                                                                // Numbers/booleans
                                                                                if (/^\s*-?\d+(\.\d+)?\s*$/.test(segment)) return <span key={sidx} className="token-number">{segment}</span>;
                                                                                if (/^\s*(true|false|null)\s*$/.test(segment)) return <span key={sidx} className="token-boolean">{segment}</span>;
                                                                                return <span key={sidx}>{segment}</span>;
                                                                            })}
                                                                        </div>
                                                                    ))}
                                                                </pre>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                            {filteredLogs.length === 0 && (
                                                <div className="text-center py-5">
                                                    <div className="opacity-20 mb-3">
                                                        <i className="bi bi-cloud-slash display-1"></i>
                                                    </div>
                                                    <p className="text-secondary h5 fw-light">{searchQuery ? `No matches found for "${searchQuery}"` : 'Log stream is currently empty'}</p>
                                                    <button className="btn btn-sm btn-outline-primary mt-3 px-4 rounded-pill" onClick={fetchLogs}>
                                                        <i className="bi bi-arrow-clockwise me-2"></i>Reconnect Source
                                                    </button>
                                                    {activeSource === 'python' && (
                                                        <p className="text-muted x-small mt-3 opacity-50">Note: Python Media Service logs are only available when the service is active.</p>
                                                    )}
                                                </div>
                                            )}
                                            <div ref={logEndRef} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .glass-card {
                    background: rgba(255, 255, 255, 0.8);
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    border-radius: 100px;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.05);
                }

                .terminal-container {
                    background: #121212;
                    border: 1px solid rgba(255,255,255,0.05);
                }

                .terminal-header {
                    background: #1a1a1a;
                }

                .control-dot {
                    width: 12px;
                    height: 12px;
                    border-radius: 50%;
                }

                .terminal-search {
                    width: 180px;
                    transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    border-radius: 30px !important;
                }

                .terminal-search:focus {
                    width: 300px;
                    background: rgba(255,255,255,0.1);
                    outline: none;
                    box-shadow: none;
                }

                .log-entry {
                    border-radius: 4px;
                    margin-bottom: 2px;
                }

                .status-default { color: #cfd8dc; }
                .status-error { color: #ff5252; border-left: 4px solid #ff5252; background: rgba(255, 82, 82, 0.08); }
                .status-warn { color: #ffd740; border-left: 4px solid #ffd740; background: rgba(255, 215, 64, 0.08); }
                .status-info { color: #e1f5fe; border-left: 4px solid #00b0ff; background: rgba(0, 176, 255, 0.05); }
                .status-debug { color: #b0bec5; opacity: 0.8; }

                .log-header {
                   transition: background 0.2s;
                   cursor: default;
                   border-bottom: 1px solid rgba(255,255,255,0.03);
                }
                .log-entry:hover .log-header {
                   background: rgba(255,255,255,0.05);
                }

                .log-prefix {
                   font-weight: 500;
                   color: #80cbc4; /* Teal for timestamp/meta */
                }
                
                .status-info .log-prefix { color: #4fc3f7; }
                .status-error .log-prefix { color: #ef5350; }
                .status-warn .log-prefix { color: #fff176; }

                .json-block {
                   font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
                   box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                   margin-right: 1rem;
                }

                .token-key { color: #ffcc80 !important; } /* Orange for keys */
                .token-string { color: #a5d6a7 !important; } /* Green for strings */
                .token-punctuation { color: #90a4ae !important; } /* Gray for punctuation */
                .token-bracket { color: #4dd0e1 !important; } /* Cyan for brackets */
                .token-number { color: #ce93d8 !important; } /* Purple for numbers */
                .token-boolean { color: #f48fb1 !important; } /* Pink for booleans */

                .x-small { font-size: 11px; }
                .fw-black { font-weight: 900; }
                .tracking-tight { letter-spacing: -0.02em; }

                .pulse-slow {
                    animation: pulse 2s infinite;
                }

                @keyframes pulse {
                    0% { transform: scale(0.95); opacity: 0.8; }
                    50% { transform: scale(1); opacity: 1; }
                    100% { transform: scale(0.95); opacity: 0.8; }
                }

                .animate-spin {
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                .pulse-green {
                    width: 8px;
                    height: 8px;
                    background: #4caf50;
                    border-radius: 50%;
                    box-shadow: 0 0 10px #4caf50;
                    animation: glow 1.5s infinite;
                }

                @keyframes glow {
                    0% { opacity: 0.5; }
                    50% { opacity: 1; }
                    100% { opacity: 0.5; }
                }

                .scroll-container::-webkit-scrollbar {
                    width: 8px;
                }
                .scroll-container::-webkit-scrollbar-track {
                    background: transparent;
                }
                .scroll-container::-webkit-scrollbar-thumb {
                    background: rgba(255,255,255,0.1);
                    border-radius: 10px;
                }
                .scroll-container::-webkit-scrollbar-thumb:hover {
                    background: rgba(255,255,255,0.2);
                }

                .loader-orbit {
                    width: 50px;
                    height: 50px;
                    border: 2px solid rgba(255,255,255,0.05);
                    border-radius: 50%;
                    position: relative;
                    animation: spin 2s linear infinite;
                }
                .orbit-dot {
                    width: 8px;
                    height: 8px;
                    background: #007bff;
                    border-radius: 50%;
                    position: absolute;
                    top: -4px;
                    left: 21px;
                    box-shadow: 0 0 15px #007bff;
                }
            `}</style>
        </AdminLayout>
    );
}
