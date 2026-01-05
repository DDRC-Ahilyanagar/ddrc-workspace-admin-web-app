'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getAbsoluteImageUrl } from '@/lib/config';

const LOGO_URL = getAbsoluteImageUrl('/ddrc app icon (192 x 192 px) (1024 x 1024 px)(1).png');

// Carousel slides data
const carouselSlides = [
  {
    id: 1,
    title: 'District Disability Rehabilitation Centre, Ahilyanagar',
    subtitle: 'जिल्हा दिव्यांग पुनर्वसन केंद्र, अहिल्यानगर',
    description: 'Ministry of Social Justice & Empowerment, Govt. of India approved',
    bgImage: '/app_back.jpg',
  },
  {
    id: 2,
    title: 'Secure & Encrypted Data Collection',
    subtitle: 'सुरक्षित आणि एन्क्रिप्टेड डेटा संकलन',
    description: 'Your sensitive information is protected with industry-standard encryption',
    bgImage: '/app_back.jpg',
  },
  {
    id: 3,
    title: 'Multi-Role Workflow System',
    subtitle: 'बहु-भूमिका कार्यप्रवाह प्रणाली',
    description: 'Streamlined process from data collection to verification and approval',
    bgImage: '/app_back.jpg',
  },
];

export default function LandingPage() {
  const router = useRouter();
  const downloadSectionRef = useRef<HTMLDivElement>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  // Language state - load from localStorage or default to 'mr' (Marathi)
  const [language, setLanguage] = useState<'en' | 'mr'>(() => {
    if (typeof window !== 'undefined') {
      const storedLang = localStorage.getItem('app_language');
      return (storedLang === 'en' || storedLang === 'mr') ? storedLang : 'mr';
    }
    return 'mr';
  });

  // Check if user is coming from login page and needs to scroll
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const userType = urlParams.get('userType');
    const scrollToDownload = urlParams.get('scrollToDownload');
    
    if (scrollToDownload === 'true' && downloadSectionRef.current) {
      setTimeout(() => {
        downloadSectionRef.current?.scrollIntoView({ 
          behavior: 'smooth',
          block: 'start'
        });
      }, 500);
    }
  }, []);

  // Auto-advance carousel
  useEffect(() => {
    if (!isAutoPlaying) return;
    
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % carouselSlides.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [isAutoPlaying, carouselSlides.length]);

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 10000);
  };

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % carouselSlides.length);
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 10000);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + carouselSlides.length) % carouselSlides.length);
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 10000);
  };

  const scrollToDownload = () => {
    if (downloadSectionRef.current) {
      downloadSectionRef.current.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
      });
    }
  };

  // Toggle language and save to localStorage
  const toggleLanguage = () => {
    const newLanguage = language === 'en' ? 'mr' : 'en';
    setLanguage(newLanguage);
    localStorage.setItem('app_language', newLanguage);
    // Optionally reload the page to apply language changes
    // window.location.reload();
  };

  return (
    <div className="landing-page">
      {/* Navigation Bar */}
      <nav className="landing-navbar">
        <div className="container">
          <div className="navbar-content">
            <div className="navbar-brand">
              <img src={LOGO_URL} alt="DDRC Logo" className="navbar-logo" />
              <div className="navbar-brand-text">
                <span className="brand-title">DDRC</span>
                <span className="brand-subtitle">Ahilyanagar</span>
              </div>
            </div>
            <div className="navbar-actions">
              {/* Language Switch Button */}
              <button
                className="btn btn-link text-primary me-2"
                onClick={toggleLanguage}
                title={language === 'en' ? 'Switch to Marathi' : 'Switch to English'}
                style={{ textDecoration: 'none', padding: '0.5rem' }}
              >
                <i className="bi bi-translate" style={{ fontSize: '1.125rem' }}></i>
                <span className="ms-1" style={{ fontSize: '0.875rem' }}>
                  {language === 'en' ? 'MR' : 'EN'}
                </span>
              </button>
              <Link href="/public" className="btn btn-outline-primary btn-sm me-2">
                Public Survey
              </Link>
              <Link href="/login" className="btn btn-primary btn-sm">
                Login
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Full-Screen Carousel */}
      <section className="hero-carousel">
        {carouselSlides.map((slide, index) => (
          <div
            key={slide.id}
            className={`carousel-slide ${index === currentSlide ? 'active' : ''}`}
            style={{
              backgroundImage: `url(${getAbsoluteImageUrl(slide.bgImage)})`,
            }}
          >
            <div className="carousel-overlay"></div>
            <div className="carousel-content">
              <div className="container">
                <div className="carousel-text">
                  <h1 className="carousel-title animate__animated animate__fadeInDown">
                    {slide.title}
                  </h1>
                  <h2 className="carousel-subtitle animate__animated animate__fadeInUp">
                    {slide.subtitle}
                  </h2>
                  <p className="carousel-description animate__animated animate__fadeInUp">
                    {slide.description}
                  </p>
                  <div className="carousel-actions animate__animated animate__fadeInUp">
                    <Link href="/public" className="btn btn-primary btn-lg me-3">
                      Start Survey
                    </Link>
                    <Link href="/login" className="btn btn-outline-light btn-lg">
                      Login
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Carousel Controls */}
        <button className="carousel-control prev" onClick={prevSlide} aria-label="Previous slide">
          <i className="bi bi-chevron-left"></i>
        </button>
        <button className="carousel-control next" onClick={nextSlide} aria-label="Next slide">
          <i className="bi bi-chevron-right"></i>
        </button>

        {/* Carousel Indicators */}
        <div className="carousel-indicators">
          {carouselSlides.map((_, index) => (
            <button
              key={index}
              className={`indicator ${index === currentSlide ? 'active' : ''}`}
              onClick={() => goToSlide(index)}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </section>

      {/* Download Mobile App Section */}
      <section ref={downloadSectionRef} className="landing-section download-section">
        <div className="container">
          <div className="download-card">
            <div className="download-header">
              <div className="download-icon">
                <i className="bi bi-phone"></i>
              </div>
              <h2 className="download-title">
                Download Mobile App
                <span className="download-title-marathi">मोबाइल ऍप डाउनलोड करा</span>
              </h2>
              <p className="download-subtitle">
                Available on Google Play Store
                <span className="download-subtitle-marathi">गूगल प्ले स्टोअरवर उपलब्ध</span>
              </p>
            </div>
            <div className="download-content">
              <div className="row align-items-center">
                <div className="col-lg-6">
                  <div className="download-info">
                    <h3>For Field Officers</h3>
                    <p className="download-text">
                      If you are a field officer, download our mobile app from the Google Play Store 
                      to collect survey data efficiently on the go. The app works offline and syncs 
                      automatically when connected.
                    </p>
                    <div className="download-features">
                      <div className="download-feature-item">
                        <i className="bi bi-check-circle-fill"></i>
                        <span>Offline data collection</span>
                      </div>
                      <div className="download-feature-item">
                        <i className="bi bi-check-circle-fill"></i>
                        <span>OCR-based data extraction</span>
                      </div>
                      <div className="download-feature-item">
                        <i className="bi bi-check-circle-fill"></i>
                        <span>Real-time synchronization</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-lg-6 text-center">
                  <div className="play-store-badge">
                    <a 
                      href="javascript:void(0)" 
                      className="play-store-link"
                      onClick={(e) => e.preventDefault()}
                    >
                      <img 
                        src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png" 
                        alt="Get it on Google Play" 
                        className="play-store-image"
                      />
                    </a>
                    <p className="play-store-note">
                      Coming soon on Google Play Store
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Surveys Section */}
      <section className="landing-section about-surveys-section">
        <div className="container">
          <div className="section-header text-center mb-5">
            <h2 className="section-title">
              About Disability Surveys
              <span className="section-title-marathi">दिव्यांग सर्वेक्षणाबद्दल</span>
            </h2>
          </div>
          <div className="row">
            <div className="col-lg-8 mx-auto">
              <div className="content-card">
                <p className="section-text">
                  The DDRC Survey Portal is a comprehensive digital platform designed to collect, manage, 
                  and process disability-related information for the District Disability Rehabilitation Centre, 
                  Ahilyanagar. This system enables efficient data collection through multiple channels and 
                  ensures secure handling of sensitive personal information.
                </p>
                <p className="section-text">
                  Our survey system captures detailed information including personal details, address information, 
                  education background, disability specifics, employment status, and various government scheme 
                  benefits. The platform uses advanced OCR (Optical Character Recognition) technology to automatically 
                  extract and pre-fill information from Aadhar cards and UDID certificates, reducing data entry time 
                  and minimizing errors.
                </p>
                <div className="survey-features">
                  <div className="row g-3">
                    <div className="col-md-6">
                      <div className="feature-box">
                        <i className="bi bi-check-circle-fill text-primary"></i>
                        <span>Multi-section comprehensive data collection</span>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="feature-box">
                        <i className="bi bi-check-circle-fill text-primary"></i>
                        <span>OCR-based automatic data extraction</span>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="feature-box">
                        <i className="bi bi-check-circle-fill text-primary"></i>
                        <span>Offline data collection capability</span>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="feature-box">
                        <i className="bi bi-check-circle-fill text-primary"></i>
                        <span>Real-time data synchronization</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* User Roles Section */}
      <section className="landing-section roles-section">
        <div className="container">
          <div className="section-header text-center mb-5">
            <h2 className="section-title">
              User Roles & Responsibilities
              <span className="section-title-marathi">वापरकर्ता भूमिका आणि जबाबदाऱ्या</span>
            </h2>
            <p className="section-subtitle">
              Each user role has specific responsibilities in the survey workflow
            </p>
          </div>
          <div className="row g-4">
            <div className="col-lg-6">
              <div className="role-card">
                <div className="role-icon">
                  <i className="bi bi-phone"></i>
                </div>
                <h3 className="role-title">Field Officer</h3>
                <p className="role-subtitle">क्षेत्र अधिकारी</p>
                <ul className="role-responsibilities">
                  <li>Capture survey data using mobile application</li>
                  <li>Collect Aadhar card images and personal information</li>
                  <li>Verify beneficiary information on-site</li>
                  <li>Upload survey data to the system</li>
                  <li>Ensure data accuracy and completeness</li>
                  <li>Work in offline mode when connectivity is limited</li>
                </ul>
              </div>
            </div>
            <div className="col-lg-6">
              <div className="role-card">
                <div className="role-icon">
                  <i className="bi bi-shield-check"></i>
                </div>
                <h3 className="role-title">Verification Officer</h3>
                <p className="role-subtitle">पडताळणी अधिकारी</p>
                <ul className="role-responsibilities">
                  <li>Review surveys assigned by administrators</li>
                  <li>Verify data accuracy and completeness</li>
                  <li>Edit survey data based on admin corrections</li>
                  <li>Mark surveys as verified after review</li>
                  <li>Ensure compliance with data standards</li>
                  <li>Handle clarification requests from beneficiaries</li>
                </ul>
              </div>
            </div>
            <div className="col-lg-6">
              <div className="role-card">
                <div className="role-icon">
                  <i className="bi bi-person-badge"></i>
                </div>
                <h3 className="role-title">Administrator</h3>
                <p className="role-subtitle">प्रशासक</p>
                <ul className="role-responsibilities">
                  <li>Oversee entire survey workflow</li>
                  <li>Review and add correction suggestions to surveys</li>
                  <li>Assign surveys to verification officers</li>
                  <li>Approve verified surveys</li>
                  <li>Manage user accounts and permissions</li>
                  <li>Generate reports and analytics</li>
                  <li>Monitor system performance and data quality</li>
                </ul>
              </div>
            </div>
            <div className="col-lg-6">
              <div className="role-card">
                <div className="role-icon">
                  <i className="bi bi-person"></i>
                </div>
                <h3 className="role-title">Public User / Beneficiary</h3>
                <p className="role-subtitle">सार्वजनिक वापरकर्ता / लाभार्थी</p>
                <ul className="role-responsibilities">
                  <li>Access public survey form via web portal</li>
                  <li>Submit personal information and documents</li>
                  <li>Upload Aadhar card images</li>
                  <li>Review submitted information</li>
                  <li>Track survey status</li>
                  <li>Respond to clarification requests if needed</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Survey Process Phases Section */}
      <section className="landing-section process-section">
        <div className="container">
          <div className="section-header text-center mb-5">
            <h2 className="section-title">
              Survey Process Phases
              <span className="section-title-marathi">सर्वेक्षण प्रक्रिया टप्पे</span>
            </h2>
            <p className="section-subtitle">
              End-to-end workflow from data collection to final approval
            </p>
          </div>
          <div className="process-timeline">
            <div className="process-step">
              <div className="step-number">1</div>
              <div className="step-content">
                <h3 className="step-title">Data Collection</h3>
                <p className="step-subtitle">डेटा संकलन</p>
                <p className="step-description">
                  Field officers or public users collect comprehensive disability-related information 
                  including personal details, address, education, disability specifics, and supporting 
                  documents. Data can be collected via mobile app or web portal.
                </p>
              </div>
            </div>
            <div className="process-step">
              <div className="step-number">2</div>
              <div className="step-content">
                <h3 className="step-title">Initial Submission</h3>
                <p className="step-subtitle">प्रारंभिक सबमिशन</p>
                <p className="step-description">
                  Collected survey data is submitted to the system with status "pending". The system 
                  automatically processes uploaded documents using OCR technology to extract relevant 
                  information and pre-fill form fields.
                </p>
              </div>
            </div>
            <div className="process-step">
              <div className="step-number">3</div>
              <div className="step-content">
                <h3 className="step-title">Admin Review</h3>
                <p className="step-subtitle">प्रशासकीय पुनरावलोकन</p>
                <p className="step-description">
                  Administrators review submitted surveys, check data quality, and add correction 
                  suggestions if needed. Surveys can be assigned to verification officers for detailed 
                  review. Status changes to "under_review".
                </p>
              </div>
            </div>
            <div className="process-step">
              <div className="step-number">4</div>
              <div className="step-content">
                <h3 className="step-title">Verification</h3>
                <p className="step-subtitle">पडताळणी</p>
                <p className="step-description">
                  Verification officers review assigned surveys, verify data accuracy, make necessary 
                  corrections based on admin suggestions, and mark surveys as "verified" after thorough 
                  review and validation.
                </p>
              </div>
            </div>
            <div className="process-step">
              <div className="step-number">5</div>
              <div className="step-content">
                <h3 className="step-title">Final Approval</h3>
                <p className="step-subtitle">अंतिम मंजूरी</p>
                <p className="step-description">
                  Administrators review verified surveys and provide final approval. Once approved, 
                  surveys are marked as "approved" and become part of the official database. Approved 
                  surveys can be used for generating certificates and accessing government schemes.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Data Security Section - Highlighted */}
      <section className="landing-section security-section">
        <div className="container">
          <div className="security-card">
            <div className="security-header">
              <div className="security-icon">
                <i className="bi bi-shield-lock-fill"></i>
              </div>
              <h2 className="security-title">
                Data Security & Encryption
                <span className="security-title-marathi">डेटा सुरक्षा आणि एन्क्रिप्शन</span>
              </h2>
            </div>
            <div className="security-content">
              <p className="security-intro">
                <strong>Your sensitive information is our top priority.</strong> We understand that 
                disability-related data contains highly sensitive personal information, and we have 
                implemented multiple layers of security to protect your data.
              </p>
              
              <div className="security-features">
                <div className="row g-4">
                  <div className="col-md-6">
                    <div className="security-feature-item">
                      <i className="bi bi-key-fill"></i>
                      <div>
                        <h4>End-to-End Encryption</h4>
                        <p>
                          All data transmitted between your device and our servers is encrypted using 
                          industry-standard TLS/SSL protocols. This ensures that your information 
                          cannot be intercepted or read during transmission.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="security-feature-item">
                      <i className="bi bi-database-lock"></i>
                      <div>
                        <h4>Database Encryption</h4>
                        <p>
                          Sensitive data stored in our databases is encrypted at rest using AES-256 
                          encryption, the same standard used by banks and government agencies. This 
                          means your data is protected even if physical access to servers is gained.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="security-feature-item">
                      <i className="bi bi-person-check-fill"></i>
                      <div>
                        <h4>Role-Based Access Control</h4>
                        <p>
                          Access to sensitive data is strictly controlled through role-based permissions. 
                          Only authorized personnel with specific roles can access, view, or modify data 
                          relevant to their responsibilities.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="security-feature-item">
                      <i className="bi bi-file-earmark-lock"></i>
                      <div>
                        <h4>Secure File Storage</h4>
                        <p>
                          Uploaded documents such as Aadhar cards and certificates are stored in 
                          encrypted storage with restricted access. Files are only accessible to 
                          authorized personnel during the verification process.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="security-feature-item">
                      <i className="bi bi-clock-history"></i>
                      <div>
                        <h4>Audit Logging</h4>
                        <p>
                          All data access and modifications are logged with timestamps and user 
                          information. This creates a complete audit trail for compliance and 
                          security monitoring purposes.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="security-feature-item">
                      <i className="bi bi-shield-check"></i>
                      <div>
                        <h4>Regular Security Updates</h4>
                        <p>
                          Our security infrastructure is regularly updated to protect against 
                          emerging threats. We follow industry best practices and comply with 
                          government data protection guidelines.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="security-note">
                <i className="bi bi-info-circle-fill"></i>
                <p>
                  <strong>Privacy Commitment:</strong> Your personal information is used solely for 
                  the purpose of providing disability rehabilitation services. Data is never shared 
                  with third-party commercial entities or used for marketing purposes. All data 
                  handling complies with government regulations and privacy laws.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="landing-section cta-section">
        <div className="container">
          <div className="cta-content text-center">
            <h2 className="cta-title">
              Ready to Get Started?
              <span className="cta-title-marathi">सुरू करण्यासाठी तयार आहात?</span>
            </h2>
            <p className="cta-text">
              Join us in our mission to empower persons with disabilities. Access our services 
              or participate in our comprehensive survey program.
            </p>
            <div className="cta-actions">
              <Link href="/public" className="btn btn-primary btn-lg me-3">
                <i className="bi bi-clipboard-check me-2"></i>
                Start Public Survey
              </Link>
              <Link href="/login" className="btn btn-outline-primary btn-lg">
                <i className="bi bi-box-arrow-in-right me-2"></i>
                Login
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="container">
          <div className="row">
            <div className="col-md-4">
              <div className="footer-brand">
                <img src={LOGO_URL} alt="DDRC Logo" className="footer-logo" />
                <h3>DDRC Ahilyanagar</h3>
                <p>
                  District Disability Rehabilitation Centre, Ahilyanagar
                  <br />
                  Ministry of Social Justice & Empowerment, Govt. of India
                </p>
              </div>
            </div>
            <div className="col-md-4">
              <h4>Quick Links</h4>
              <ul className="footer-links">
                <li><Link href="/public">Public Survey</Link></li>
                <li><Link href="/login">Login</Link></li>
                <li><Link href="/dashboard">Dashboard</Link></li>
              </ul>
            </div>
            <div className="col-md-4">
              <h4>Contact</h4>
              <p>
                District Disability Rehabilitation Centre
                <br />
                Ahilyanagar, Maharashtra, India
              </p>
              <p className="footer-powered">
                Powered by <a href="https://ddrcnagar.in" target="_blank" rel="noopener noreferrer" className="footer-utkrranti">UTKRRANTI</a>
              </p>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; {new Date().getFullYear()} DDRC Ahilyanagar. All rights reserved.</p>
        </div>
        </div>
      </footer>
    </div>
  );
}
