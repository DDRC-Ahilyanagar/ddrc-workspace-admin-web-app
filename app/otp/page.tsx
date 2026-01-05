'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { sendOTP, verifyOTP, fetchUserByPhone } from '@/lib/api-client';
import { getAbsoluteImageUrl } from '@/lib/config';

const LOGO_URL = getAbsoluteImageUrl('/ddrc app icon (192 x 192 px) (1024 x 1024 px)(1).png');

function OTPContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const phoneParam = searchParams.get('phone') || '';
  
  const [phone, setPhone] = useState(phoneParam);
  const [name, setName] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameLoading, setNameLoading] = useState(false);
  const [nameError, setNameError] = useState('');
  const [userType, setUserType] = useState('');

  useEffect(() => {
    const storedName = localStorage.getItem('user_name') || '';
    const storedPhone = localStorage.getItem('user_phone') || phoneParam;
    const storedUserType = localStorage.getItem('user_type') || '';
    setName(storedName);
    setUserType(storedUserType);
    if (!phone && storedPhone) {
      setPhone(storedPhone);
    }
  }, [phoneParam]);

  useEffect(() => {
    let active = true;
    const loadName = async () => {
      if (!phone || phone.length !== 10) {
        if (active) {
          setNameError('');
          setNameLoading(false);
        }
        return;
      }

      setNameLoading(true);
      setNameError('');
      const response = await fetchUserByPhone(phone);
      if (!active) return;

      if (response.ok && response.user) {
        const fetchedName = response.user.name || '';
        const fetchedUserType = response.user.user_type || '';
        if (!isEditingName) {
          setName(fetchedName);
        }
        localStorage.setItem('user_name', fetchedName);
        if (fetchedUserType) {
          setUserType(fetchedUserType);
          localStorage.setItem('user_type', fetchedUserType);
        }
        setNameError('');
      } else {
        if (!isEditingName) {
          setName('');
        }
        setNameError(
          response.error === 'user_not_found'
            ? 'वापरकर्ता आढळला नाही'
            : response.error || 'नाव उपलब्ध नाही'
        );
      }

      setNameLoading(false);
    };

    loadName();

    return () => {
      active = false;
    };
  }, [phone, isEditingName]);

  const handleVerify = async () => {
    setError('');
    if (otp.length !== 6) {
      setError('६ अंकी ओटीपी लिहा');
      return;
    }

    setLoading(true);
    try {
      const response = await verifyOTP(phone, otp, name, 'web');
      if (response.ok) {
        localStorage.setItem('logged_in', 'true');
        localStorage.setItem('user_name', name);
        localStorage.setItem('user_phone', phone);
        // Store user_type if available
        if (response.user?.user_type) {
          localStorage.setItem('user_type', response.user.user_type);
        }
        router.push('/dashboard');
      } else {
        setError(response.error || 'पडताळणी अयशस्वी');
      }
    } catch (err: any) {
      setError('नेटवर्क त्रुटी');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      const response = await sendOTP(phone, 'web');
      if (response.ok) {
        alert('ओटीपी पुन्हा पाठवला गेला');
      } else {
        setError('ओटीपी पाठवण्यात अडचण');
      }
    } catch (err: any) {
      setError('ओटीपी पाठवण्यात अडचण आली');
    } finally {
      setResending(false);
    }
  };

  useEffect(() => {
    if (otp.length === 6 && !loading && phone) {
      handleVerify();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  return (
    <div className="login-page-container">
      <div className="login-row">
        {/* Left Side - 60% */}
        <div className="login-left-side d-flex flex-column align-items-center justify-content-center animate__animated animate__fadeInLeft">
          <div className="login-branding text-center">
            <img 
              src={LOGO_URL} 
              alt="DDRC Logo" 
              className="login-logo mb-5 animate__animated animate__fadeInDown"
              style={{ maxWidth: '450px', width: '100%', height: 'auto' }}
            />
            <div className="login-title-section animate__animated animate__fadeInUp">
              <h1 className="login-title-main text-white">
                District Disability Rehabilitation Centre, Nagar
              </h1>
              <p className="login-title-sub text-white">
                ( Ministry of Social Justice & Empowerment, Govt. of India approved)
              </p>
              <h2 className="login-title-marathi text-white">
                जिल्हा दिव्यांग पुनर्वसन केंद्र, अहिल्यानगर
              </h2>
              <p className="login-title-marathi-sub text-white">
                ( सामाजिक न्याय व अधिकारिता मंत्रालय भारत सरकार द्वारा नियुक्त )
              </p>
            </div>
          </div>
        </div>

        {/* Right Side - 40% */}
        <div className="login-right-side d-flex flex-column align-items-center justify-content-center animate__animated animate__fadeInRight">
          {/* Mobile-only branding section */}
          <div className="login-mobile-branding">
            <div className="text-center mb-4">
              <img 
                src={LOGO_URL} 
                alt="DDRC Logo" 
                className="login-mobile-logo mb-3"
              />
              <h1 className="login-mobile-title-main">
                District Disability Rehabilitation Centre, Ahilyanagar
              </h1>
              <p className="login-mobile-title-sub">
                ( Ministry of Social Justice & Empowerment, Govt. of India approved)
              </p>
              <h2 className="login-mobile-title-marathi">
                जिल्हा दिव्यांग पुनर्वसन केंद्र, अहिल्यानगर
              </h2>
              <p className="login-mobile-title-marathi-sub">
                ( सामाजिक न्याय व अधिकारिता मंत्रालय भारत सरकार द्वारा नियुक्त )
              </p>
            </div>
          </div>
          
          <div className="login-card-wrapper">
            <div className="card shadow-lg border-0">
              <div className="card-body">
                <h3 className="card-title text-center">ओटीपी पडताळणी</h3>
                
                <div className="mb-4">
                  <label className="form-label">मोबाईल क्रमांक</label>
                  {isEditingPhone ? (
                    <input
                      type="tel"
                      className="form-control"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      onBlur={() => setIsEditingPhone(false)}
                      autoFocus
                      maxLength={10}
                    />
                  ) : (
                    <div className="d-flex align-items-center">
                      <input
                        type="text"
                        className="form-control"
                        value={phone}
                        readOnly
                        style={{ flex: 1, backgroundColor: '#f8f9fa', cursor: 'default' }}
                      />
                      <button
                        type="button"
                        className="btn btn-link ms-2"
                        onClick={() => setIsEditingPhone(!isEditingPhone)}
                        style={{ padding: '0.5rem' }}
                      >
                        <i className="bi bi-pencil"></i>
                      </button>
                    </div>
                  )}
                </div>

                <div className="mb-4">
                  <label className="form-label">नाव</label>
                  {isEditingName ? (
                    <input
                      type="text"
                      className="form-control"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        localStorage.setItem('user_name', e.target.value);
                      }}
                      onBlur={() => setIsEditingName(false)}
                      autoFocus
                    />
                  ) : (
                    <div className="d-flex align-items-center">
                      <input
                        type="text"
                        className="form-control"
                        value={nameLoading ? 'लोड होत आहे...' : (name || 'नाव उपलब्ध नाही')}
                        readOnly
                        style={{ flex: 1, backgroundColor: '#f8f9fa', cursor: 'default' }}
                      />
                      <button
                        type="button"
                        className="btn btn-link ms-2"
                        onClick={() => setIsEditingName(!isEditingName)}
                        style={{ padding: '0.5rem' }}
                      >
                        <i className="bi bi-pencil"></i>
                      </button>
                    </div>
                  )}
                  {nameError && !isEditingName && (
                    <div className="text-danger mt-2 small">{nameError}</div>
                  )}
                </div>

                {/* User Type Display */}
                {userType && (
                  <div className="mb-4">
                    <label className="form-label">भूमिका (Role)</label>
                    <div className="d-flex align-items-center">
                      <span className="badge bg-primary fs-6 px-3 py-2" style={{ fontSize: '0.95rem', fontWeight: '500' }}>
                        {(() => {
                          const normalizedType = userType.toLowerCase().trim();
                          if (normalizedType === 'verification_officer') return 'Verification Officer';
                          if (normalizedType === 'admin') return 'Admin';
                          if (normalizedType === 'field_officer') return 'Field Officer';
                          if (normalizedType === 'supervisor') return 'Supervisor';
                          // Fallback: capitalize and replace underscores
                          return userType.charAt(0).toUpperCase() + userType.slice(1).replace(/_/g, ' ');
                        })()}
                      </span>
                    </div>
                  </div>
                )}

                <div className="mb-4">
                  <label className="form-label">६ अंकी ओटीपी लिहा</label>
                  <input
                    type="text"
                    className="form-control"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                    placeholder="000000"
                  />
                </div>

                {error && (
                  <div className="alert alert-danger" role="alert">
                    {error}
                  </div>
                )}

                <button
                  type="button"
                  className="btn btn-link w-100 mb-3 text-decoration-none"
                  onClick={handleResend}
                  disabled={resending || loading}
                  style={{ color: 'var(--text-200)' }}
                >
                  {resending ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                      पाठवत आहे...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-arrow-clockwise me-2"></i>
                      ओटीपी पुन्हा पाठवा
                    </>
                  )}
                </button>

                <button
                  type="button"
                  className="btn btn-primary w-100"
                  onClick={handleVerify}
                  disabled={loading || resending || otp.length !== 6}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                      पडताळत आहे...
                    </>
                  ) : (
                    'पडताळा'
                  )}
                </button>
              </div>
            </div>
            <div className="text-center mt-5">
              <small className="text-muted">Powered by UT<span className="text-danger">K</span>RRANTI</small>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OTPPage() {
  return (
    <Suspense fallback={
      <div className="container-fluid py-4">
        <div className="text-center">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">लोड होत आहे...</span>
          </div>
        </div>
      </div>
    }>
      <OTPContent />
    </Suspense>
  );
}

