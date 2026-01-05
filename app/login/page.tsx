'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { sendOTP } from '@/lib/api-client';

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (phone.length !== 10) {
      setError('१० अंकी मोबाईल क्रमांक लिहा');
      return;
    }

    setLoading(true);
    try {
      const response = await sendOTP(phone, 'web');
      if (response.ok) {
        localStorage.setItem('user_phone', phone);
        router.push(`/otp?phone=${phone}`);
      } else {
        setError(response.error || 'ओटीपी पाठवण्यात अडचण');
      }
    } catch (err: any) {
      setError('नेटवर्क त्रुटी, कृपया पुन्हा प्रयत्न करा');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-container">
      <div className="login-row">
        {/* Left Side - 60% */}
        <div className="login-left-side d-flex flex-column align-items-center justify-content-center animate__animated animate__fadeInLeft">
          <div className="login-branding text-center">
            <img 
              src="/ddrc app icon (192 x 192 px) (1024 x 1024 px)(1).png" 
              alt="DDRC Logo" 
              className="login-logo mb-5 animate__animated animate__fadeInDown"
              style={{ maxWidth: '450px', width: '100%', height: 'auto' }}
            />
            <div className="login-title-section animate__animated animate__fadeInUp">
              <h1 className="login-title-main text-white">
                District Disability Rehabilitation Centre, Ahilyanagar
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
                src="/ddrc app icon (192 x 192 px) (1024 x 1024 px)(1).png" 
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
                <h3 className="card-title text-center">लॉगिन</h3>
                <form onSubmit={handleSubmit}>
                  <div className="mb-4">
                    <label className="form-label fw-semibold">मोबाईल क्रमांक (10 अंक)</label>
                    <input
                      type="tel"
                      className="form-control"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      maxLength={10}
                      placeholder="9876543210"
                      required
                    />
                  </div>
                  {error && (
                    <div className="alert alert-danger mb-4" role="alert">
                      {error}
                    </div>
                  )}
                  <button
                    type="submit"
                    className="btn btn-primary w-100"
                    disabled={loading || phone.length !== 10}
                  >
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                        पाठवत आहे...
                      </>
                    ) : (
                      'ओटीपी पाठवा'
                    )}
                  </button>
                </form>
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
