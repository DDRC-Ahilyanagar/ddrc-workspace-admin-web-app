'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface AppLog {
    id: string;
    sessionId: string;
    level: string;
    message: string;
    details: any;
    stage: string;
    createdAt: string;
}

const LogDashboard = () => {
    const [logs, setLogs] = useState<AppLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [autoPoll, setAutoPoll] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
    const [authorized, setAuthorized] = useState<boolean | null>(null);
    const ALLOWED_ADMIN_PHONE = '7768068585';

    const fetchLogs = useCallback(async () => {
        const userPhone = localStorage.getItem('user_phone') || '';

        if (userPhone !== ALLOWED_ADMIN_PHONE) {
            setAuthorized(false);
            setLoading(false);
            return;
        }

        setAuthorized(true);
        try {
            const response = await fetch('/api/logs?limit=100', {
                headers: {
                    'Authorization': `Bearer ${userPhone}`
                }
            });
            const data = await response.json();
            if (data.success) {
                setLogs(data.logs);
                setLastUpdated(new Date());
            } else if (response.status === 403) {
                setAuthorized(false);
            }
        } catch (error) {
            console.error('Failed to fetch logs:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (autoPoll) {
            interval = setInterval(fetchLogs, 3000); // Poll every 3 seconds
        }
        return () => clearInterval(interval);
    }, [autoPoll, fetchLogs]);

    const getLevelColor = (level: string) => {
        switch (level.toLowerCase()) {
            case 'error': return 'bg-red-500 text-white';
            case 'warn': return 'bg-yellow-500 text-black';
            case 'info': return 'bg-blue-500 text-white';
            case 'debug': return 'bg-gray-500 text-white';
            case 'success': return 'bg-green-500 text-white';
            default: return 'bg-blue-500 text-white';
        }
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString();
    };

    if (authorized === false) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-slate-800/50 border border-slate-700/50 p-8 rounded-3xl backdrop-blur-xl text-center shadow-2xl">
                    <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20">
                        <i className="bi bi-shield-lock text-4xl"></i>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-100 mb-2">Access Denied</h2>
                    <p className="text-slate-400 mb-8">
                        You do not have permission to view live logs. This dashboard is restricted to authorized administrators only.
                    </p>
                    <button
                        onClick={() => window.location.href = '/dashboard'}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-600/20"
                    >
                        Back to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-4 md:p-8">
            {/* Header */}
            <div className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-teal-400 bg-clip-text text-transparent">
                        Live Application Logs
                    </h1>
                    <p className="text-slate-400 mt-1">
                        Real-time stage monitoring for DDRC Workspace
                    </p>
                </div>

                <div className="flex items-center gap-4 bg-slate-800/50 p-3 rounded-2xl border border-slate-700/50 backdrop-blur-sm">
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${autoPoll ? 'bg-green-500 animate-pulse' : 'bg-slate-600'}`}></div>
                        <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                            {autoPoll ? 'Auto-polling Active' : 'Polling Paused'}
                        </span>
                    </div>

                    <button
                        onClick={() => setAutoPoll(!autoPoll)}
                        className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-300 ${autoPoll
                            ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                            : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                            }`}
                    >
                        {autoPoll ? 'Pause' : 'Resume'}
                    </button>

                    <button
                        onClick={fetchLogs}
                        className="p-1.5 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
                        title="Manual Refresh"
                    >
                        <i className="bi bi-arrow-clockwise"></i>
                    </button>
                </div>
            </div>

            {/* Stats Quick View (Mock or real if needed) */}
            <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                {[
                    { label: 'Total Logs (Last 100)', value: logs.length, color: 'blue' },
                    { label: 'Errors', value: logs.filter(l => l.level === 'error').length, color: 'red' },
                    { label: 'Success Stages', value: logs.filter(l => l.level === 'success').length, color: 'green' },
                    { label: 'Last Update', value: formatTime(lastUpdated.toISOString()), color: 'teal' }
                ].map((stat, i) => (
                    <div key={i} className="bg-slate-800/40 border border-slate-700/50 p-4 rounded-2xl backdrop-blur-md">
                        <p className="text-slate-400 text-xs font-medium uppercase tracking-widest">{stat.label}</p>
                        <p className="text-2xl font-bold mt-1 text-slate-100">{stat.value}</p>
                    </div>
                ))}
            </div>

            {/* Main Table */}
            <div className="max-w-7xl mx-auto">
                <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl overflow-hidden backdrop-blur-md shadow-2xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-900/50 border-b border-slate-700/50">
                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-400">Timestamp</th>
                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-400">Level</th>
                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-400">Stage</th>
                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-400">Message</th>
                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-400 text-right">Session ID</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/30">
                                {loading && logs.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500 italic">
                                            Initial loading...
                                        </td>
                                    </tr>
                                ) : logs.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500 italic">
                                            No logs collected yet.
                                        </td>
                                    </tr>
                                ) : (
                                    logs.map((log) => (
                                        <tr key={log.id} className="hover:bg-slate-700/20 transition-colors group">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-medium text-slate-200">{formatTime(log.createdAt)}</div>
                                                <div className="text-[10px] text-slate-500">{formatDate(log.createdAt)}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${getLevelColor(log.level)}`}>
                                                    {log.level}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="text-xs font-mono py-1 px-2 bg-slate-700/30 rounded text-blue-300 border border-blue-500/20">
                                                    {log.stage || 'N/A'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm text-slate-300 max-w-md truncate group-hover:block whitespace-normal">
                                                    {log.message}
                                                    {log.details && Object.keys(log.details).length > 0 && (
                                                        <pre className="mt-2 text-[10px] bg-black/30 p-2 rounded overflow-x-auto text-slate-400 line-clamp-2 hover:line-clamp-none transition-all">
                                                            {JSON.stringify(log.details, null, 2)}
                                                        </pre>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right whitespace-nowrap">
                                                <span className="text-xs font-mono text-slate-500 select-all cursor-pointer hover:text-slate-300">
                                                    {log.sessionId ? log.sessionId.substring(0, 8) + '...' : 'anon'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <style jsx global>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .5; }
        }
        .animate-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>
        </div>
    );
};

export default LogDashboard;
