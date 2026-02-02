'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function FieldOfficerSignup() {
    const router = useRouter();
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        email: '',
        userType: 'FIELD_OFFICER' as 'FIELD_OFFICER' | 'VERIFICATION_OFFICER',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/field-officer/signup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            const data = await res.json();

            if (data.ok) {
                setSuccess(true);
            } else {
                setError(data.error || 'नोंदणी अयशस्वी. कृपया पुन्हा प्रयत्न करा.');
            }
        } catch (err) {
            setError('सिस्टममध्ये त्रुटी आली. कृपया नंतर प्रयत्न करा.');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="max-w-md w-full bg-white rounded-[32px] p-12 shadow-2xl border border-slate-100 text-center animate-in fade-in zoom-in duration-500">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-8">
                        <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h2 className="text-3xl font-black text-slate-900 mb-4">नोंदणी यशस्वी!</h2>
                    <p className="text-slate-600 font-bold mb-10 leading-relaxed">
                        आपली विनंती प्राप्त झाली आहे. ऍडमिनच्या मंजुरीनंतर आपल्याला SMS द्वारे कळवले जाईल.
                    </p>
                    <div className="flex flex-col gap-3">
                        <Link href="/" className="inline-flex items-center justify-center gap-3 px-8 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-[#003f86] transition-all shadow-lg active:scale-95">
                            मुख्य पृष्ठावर जा
                        </Link>
                        <a
                            href="https://play.google.com/store/apps/details?id=com.utkrranti.ddrc.ahilyanagar&pcampaignid=web_share"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-3 px-8 py-4 bg-[#009cc5] text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-[#003f86] transition-all shadow-lg active:scale-95 no-underline"
                        >
                            <i className="bi bi-google-play"></i>
                            अ‍ॅप डाउनलोड करा (Download App)
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#003f86] to-[#009cc5] flex items-center justify-center p-4 md:p-8 relative overflow-hidden">
            {/* Background Decorations */}
            <div className="absolute top-[-10%] right-[-10%] w-[300px] md:w-[600px] h-[300px] md:h-[600px] bg-white/10 rounded-full blur-[80px] md:blur-[120px]"></div>
            <div className="absolute bottom-[-10%] left-[-10%] w-[250px] md:w-[500px] h-[250px] md:h-[500px] bg-[#009cc5] rounded-full blur-[60px] md:blur-[100px]"></div>

            <div className="w-full max-w-[440px] relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="bg-white/95 backdrop-blur-xl rounded-[32px] md:rounded-[48px] p-8 md:p-12 shadow-[0_40px_100px_rgba(0,0,0,0.2)] border border-white/20">
                    <div className="text-center mb-10">
                        <Link href="/" className="inline-block no-underline">
                            <div className="bg-gradient-to-br from-[#003f86] to-[#009cc5] w-20 h-20 rounded-[28%] flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-[#009cc5]/40 rotate-3 hover:rotate-0 transition-all duration-500 border border-white/20">
                                <img src="/ddrc app icon (192 x 192 px) (1024 x 1024 px)(1).png" alt="Logo" className="w-12 h-12 object-contain invert" />
                            </div>
                        </Link>
                        <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight leading-none">क्षेत्रीय अधिकारी नोंदणी</h1>
                        <p className="text-[#003f86] font-black text-[10px] md:text-xs mt-3 uppercase tracking-[0.2em] opacity-70">Field Officer Registration</p>
                    </div>

                    <div className="mb-6">
                        <Link href="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-[#003f86] transition-all font-black text-[10px] uppercase tracking-widest no-underline group">
                            <i className="bi bi-arrow-left group-hover:-translate-x-1 transition-transform"></i>
                            मुख्यपृष्ठावर जा (Back to Home)
                        </Link>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5 md:space-y-6">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2.5 ml-1">
                                पूर्ण नाव (Full Name) <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                id="signup_name"
                                required
                                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-100 focus:bg-white transition-all font-bold text-slate-900 text-sm md:text-base placeholder:text-slate-300"
                                placeholder="उदा. राजेश कुमार"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2.5 ml-1">
                                वापरकर्ता प्रकार (User Type) <span className="text-red-500">*</span>
                            </label>
                            <select
                                id="signup_user_type"
                                required
                                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-100 focus:bg-white transition-all font-bold text-slate-900 text-sm md:text-base"
                                value={formData.userType}
                                onChange={(e) => setFormData({ ...formData, userType: e.target.value as 'FIELD_OFFICER' | 'VERIFICATION_OFFICER' })}
                            >
                                <option id="option_field_officer" value="FIELD_OFFICER">क्षेत्रीय अधिकारी (Field Officer)</option>
                                <option id="option_verification_officer" value="VERIFICATION_OFFICER">पडताळणी अधिकारी (Verification Officer)</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2.5 ml-1">
                                मोबाईल क्रमांक (Mobile) <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="tel"
                                id="signup_phone"
                                required
                                pattern="[0-9]{10}"
                                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-100 focus:bg-white transition-all font-bold text-slate-900 text-sm md:text-base placeholder:text-slate-300"
                                placeholder="10 अंकी क्रमांक"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2.5 ml-1">
                                ईमेल (Email) <span className="text-slate-300 font-medium normal-case ml-1">(Optional)</span>
                            </label>
                            <input
                                type="email"
                                id="signup_email"
                                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-100 focus:bg-white transition-all font-bold text-slate-900 text-sm md:text-base placeholder:text-slate-300"
                                placeholder="example@email.com"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>

                        {error && (
                            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-xs md:text-sm font-bold flex items-center gap-3 animate-shake">
                                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            id="signup_submit_btn"
                            disabled={loading}
                            className="w-full py-4.5 md:py-5 bg-[#003f86] text-white rounded-2xl font-black text-base md:text-lg tracking-wide transition-all hover:bg-[#3eac53] hover:shadow-[0_20px_40px_rgba(37,99,235,0.3)] hover:-translate-y-1 active:scale-95 disabled:opacity-50 disabled:pointer-events-none mt-4 relative overflow-hidden group shadow-xl shadow-[#003f86]/20"
                        >
                            <span className={`flex items-center justify-center gap-3 ${loading ? 'opacity-0' : 'opacity-100'}`}>
                                नोंदणी करा (Register Now)
                                <svg className="w-5 h-5 md:w-6 md:h-6 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                </svg>
                            </span>
                            {loading && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            )}
                        </button>
                    </form>

                    <div className="mt-10 py-6 border-t border-slate-100 text-center">
                        <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-4">आधीच खाते आहे?</p>
                        <a
                            href="https://play.google.com/store/apps/details?id=com.utkrranti.ddrc.ahilyanagar&pcampaignid=web_share"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block px-8 py-3 bg-slate-100 text-slate-900 font-black rounded-xl hover:bg-slate-200 transition-all uppercase text-[10px] tracking-widest no-underline"
                        >
                            लॉगिन करा (Login)
                        </a>
                    </div>
                </div>

                <div className="mt-8 text-center space-y-2 relative z-10">
                    <p className="text-white/60 font-bold text-[9px] md:text-[10px] uppercase tracking-[0.4em] mb-0">&copy; 2026 OFFICIAL DDRC PORTAL</p>
                    <p className="text-white/90 text-[10px] font-bold uppercase tracking-widest mb-0">
                        Designed & Engineered by <a href="https://utkrranti.com" target="_blank" rel="noopener noreferrer" className="!no-underline hover:opacity-80 transition-opacity" style={{ textDecoration: 'none' }}>
                            <span className="text-white">UT</span><span className="text-[#FF0000]">K</span><span className="text-white">RRANTI</span>
                        </a>
                    </p>
                </div>
            </div>

            <style jsx>{`
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-4px); }
                    75% { transform: translateX(4px); }
                }
                .animate-shake {
                    animation: shake 0.2s ease-in-out 0s 2;
                }
            `}</style>
        </div>
    );
}
