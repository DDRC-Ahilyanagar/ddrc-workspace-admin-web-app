"use client";

import React, { useState, useTransition } from "react";
import { deleteAccountAction, DeleteAccountResponse } from "./actions";
import "./delete-account.css";
import Image from "next/image";

export default function DeleteAccountPage() {
    const [result, setResult] = useState<DeleteAccountResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);
        setResult(null);

        const formData = new FormData(event.currentTarget);
        const identifier = formData.get("identifier") as string;

        if (!identifier) {
            setError("Please enter your email or mobile number.");
            return;
        }

        // Basic confirmation
        if (!confirm("Are you sure you want to permanently delete your account? This action cannot be undone and all your data (surveys, profile, files) will be removed.")) {
            return;
        }

        startTransition(async () => {
            const resp = await deleteAccountAction(formData);
            if (resp.success) {
                setResult(resp);
            } else {
                setError(resp.message);
            }
        });
    }

    return (
        <main className="delete-account-container">
            <div className="delete-card">
                {result ? (
                    <div className="success-state animate__animated animate__fadeIn">
                        <div className="success-icon">
                            <i className="bi bi-check-circle-fill"></i>
                        </div>
                        <h2>Account Deleted</h2>
                        <p>{result.message}</p>
                        <div style={{ marginTop: '30px' }}>
                            <p style={{ fontSize: '14px', color: '#888' }}>
                                Your request has been processed successfully for Play Store compliance.
                            </p>
                        </div>
                        <button
                            onClick={() => window.location.href = '/'}
                            className="submit-btn"
                            style={{ background: '#0d47a1', marginTop: '20px' }}
                        >
                            Return to Home
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="card-header">
                            <div className="logo-container">
                                <Image
                                    src="/colored_logo.png"
                                    alt="DDRC Logo"
                                    width={100}
                                    height={100}
                                    className="logo-image"
                                />
                            </div>
                            <h1>Account Deletion Request / खाते हटवण्याची विनंती</h1>
                            <p style={{ margin: '10px 0 0', color: '#666', fontSize: '14px' }}>
                                District Disability Rehabilitation Centre, Ahilyanagar <br />
                                जिल्हा दिव्यांग पुनर्वसन केंद्र, अहिल्यानगर
                            </p>
                        </div>
                        <div className="card-body">
                            <p className="description">
                                If you wish to delete your Field Officer account and all associated data,
                                please enter your registered Email ID or Mobile Number below. <br />
                                <span style={{ fontSize: '14px', fontStyle: 'italic', display: 'block', marginTop: '10px' }}>
                                    जर तुम्हाला तुमचे खाते आणि संबंधित सर्व डेटा हटवायचा असेल, तर कृपया तुमचा नोंदणीकृत ईमेल किंवा मोबाईल नंबर खाली टाका.
                                </span>
                            </p>

                            {error && <div className="error-message animate__animated animate__shakeX">{error}</div>}

                            <form onSubmit={handleSubmit}>
                                <div className="form-group">
                                    <label htmlFor="identifier">Email ID or Mobile Number / ईमेल किंवा मोबाईल नंबर</label>
                                    <input
                                        type="text"
                                        id="identifier"
                                        name="identifier"
                                        className="form-control"
                                        placeholder="e.g. user@example.com or 98XXXXXXXX"
                                        required
                                        disabled={isPending}
                                    />
                                </div>

                                <div style={{ marginBottom: '25px', padding: '15px', background: '#fff3cd', borderRadius: '8px', border: '1px solid #ffeeba' }}>
                                    <p style={{ margin: 0, fontSize: '13px', color: '#856404' }}>
                                        <strong>Warning:</strong> Deleting your account will permanently remove all your survey records,
                                        profile details, and uploaded documents. This process is irreversible. <br />
                                        <strong>सूचना:</strong> खाते हटवल्यास तुमचे सर्व सर्वेक्षण रेकॉर्ड, प्रोफाईल माहिती आणि दस्तऐवज कायमचे काढून टाकले जातील. ही प्रक्रिया पुन्हा बदलता येणार नाही.
                                    </p>
                                </div>

                                <button
                                    type="submit"
                                    className="submit-btn"
                                    disabled={isPending}
                                >
                                    {isPending ? "Processing..." : "Delete My Account / माझे खाते हटवा"}
                                </button>
                            </form>
                        </div>
                    </>
                )}
            </div>

            <div className="footer">
                &copy; {new Date().getFullYear()} DDRC Ahilyanagar. All rights reserved.
            </div>
        </main>
    );
}
