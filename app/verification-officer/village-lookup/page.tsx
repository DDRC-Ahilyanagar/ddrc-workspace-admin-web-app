
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/AdminLayout';

export default function VillageLookupPage() {
    const router = useRouter();
    const [talukas, setTalukas] = useState<string[]>([]);
    const [selectedTaluka, setSelectedTaluka] = useState('');
    const [villages, setVillages] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingVillages, setLoadingVillages] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [copySuccess, setCopySuccess] = useState<string | null>(null);

    useEffect(() => {
        const loggedIn = localStorage.getItem('logged_in');
        const userType = localStorage.getItem('user_type') || '';

        if (!loggedIn || loggedIn !== 'true') {
            router.push('/login');
            return;
        }

        const normalizedUserType = userType.toLowerCase().trim();
        if (normalizedUserType !== 'verification_officer' && normalizedUserType !== 'admin') {
            router.push('/dashboard');
            return;
        }

        fetchTalukas();
    }, [router]);

    const fetchTalukas = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/get-talukas');
            const data = await res.json();
            if (data.ok) {
                setTalukas(data.talukas || []);
            }
        } catch (err) {
            console.error('Failed to fetch talukas', err);
        } finally {
            setLoading(false);
        }
    };

    const handleTalukaChange = async (taluka: string) => {
        setSelectedTaluka(taluka);
        if (!taluka) {
            setVillages([]);
            return;
        }

        setLoadingVillages(true);
        setSearchTerm('');
        try {
            const res = await fetch(`/api/get-villages?taluka=${encodeURIComponent(taluka)}`);
            const data = await res.json();
            if (data.ok) {
                setVillages(data.villages || []);
            }
        } catch (err) {
            console.error('Failed to fetch villages', err);
        } finally {
            setLoadingVillages(false);
        }
    };

    const copyToClipboard = (text: string) => {
        if (typeof window !== 'undefined' && navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => {
                setCopySuccess(text);
                setTimeout(() => setCopySuccess(null), 2000);
            });
        }
    };

    const filteredVillages = villages.filter(v =>
        v.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <AdminLayout>
            <div className="container-fluid py-4">
                <div className="d-flex justify-content-between align-items-center mb-4">
                    <h1 className="h3 mb-0 text-gray-800">गाव नावे शोधा (Village Lookup)</h1>
                </div>

                <div className="card shadow mb-4">
                    <div className="card-header py-3 bg-primary text-white">
                        <h6 className="m-0 font-weight-bold">विवरण निवडा</h6>
                    </div>
                    <div className="card-body">
                        <div className="row">
                            <div className="col-md-4 mb-3">
                                <label className="form-label fw-bold">तालुका निवडा:</label>
                                <select
                                    className="form-select"
                                    value={selectedTaluka}
                                    onChange={(e) => handleTalukaChange(e.target.value)}
                                    disabled={loading}
                                >
                                    <option value="">-- निवडा --</option>
                                    {talukas.map(t => (
                                        <option key={t} value={t}>{t}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="col-md-8 mb-3">
                                <label className="form-label fw-bold">गाव शोधा:</label>
                                <div className="input-group">
                                    <span className="input-group-text bg-white border-end-0">
                                        <i className="bi bi-search"></i>
                                    </span>
                                    <input
                                        type="text"
                                        className="form-control border-start-0"
                                        placeholder="गावाचे नाव टाईप करा..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        disabled={!selectedTaluka || loadingVillages}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {selectedTaluka && (
                    <div className="card shadow mb-4">
                        <div className="card-header py-3 d-flex justify-content-between align-items-center">
                            <h6 className="m-0 font-weight-bold text-primary">गांव यादी: {selectedTaluka}</h6>
                            <span className="badge bg-secondary">{filteredVillages.length} गावे सापडली</span>
                        </div>
                        <div className="card-body">
                            {loadingVillages ? (
                                <div className="text-center py-5">
                                    <div className="spinner-border text-primary" role="status">
                                        <span className="visually-hidden">लोड होत आहे...</span>
                                    </div>
                                </div>
                            ) : villages.length === 0 ? (
                                <div className="text-center py-5 text-muted">
                                    <i className="bi bi-info-circle me-2"></i>
                                    या तालुक्यासाठी कोणतेही गाव सापडले नाही.
                                </div>
                            ) : (
                                <div className="table-responsive">
                                    <table className="table table-bordered table-hover">
                                        <thead className="table-light">
                                            <tr>
                                                <th style={{ width: '80%' }}>गावाचे नाव (Village Name)</th>
                                                <th className="text-center">ॲक्शन</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredVillages.map((village, idx) => (
                                                <tr key={idx}>
                                                    <td className="align-middle fw-medium">{village}</td>
                                                    <td className="text-center">
                                                        <button
                                                            className={`btn btn-sm ${copySuccess === village ? 'btn-success' : 'btn-outline-primary'}`}
                                                            onClick={() => copyToClipboard(village)}
                                                            title="नाव कॉपी करा"
                                                        >
                                                            {copySuccess === village ? (
                                                                <><i className="bi bi-check-lg"></i> कॉपी झाले</>
                                                            ) : (
                                                                <><i className="bi bi-clipboard"></i> कॉपी करा</>
                                                            )}
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {filteredVillages.length === 0 && (
                                                <tr>
                                                    <td colSpan={2} className="text-center py-3 text-muted">
                                                        सर्चनुसार कोणतेही गाव सापडले नाही.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
