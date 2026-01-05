'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getAbsoluteImageUrl } from '@/lib/config';

const LOGO_URL = getAbsoluteImageUrl('/ddrc app icon (192 x 192 px) (1024 x 1024 px)(1).png');

// Carousel slides data
const carouselSlides = [
  {
    id: 1,
    title: 'District Disability Rehabilitation Centre',
    subtitle: 'जिल्हा दिव्यांग पुनर्वसन केंद्र',
    description: 'Empowering lives through comprehensive rehabilitation services',
    bgImage: '/app_back.jpg',
  },
  {
    id: 2,
    title: 'Ministry Approved',
    subtitle: 'भारत सरकार द्वारा मान्यता प्राप्त',
    description: 'Ministry of Social Justice & Empowerment, Govt. of India',
    bgImage: '/app_back.jpg',
  },
  {
    id: 3,
    title: 'Comprehensive Survey Portal',
    subtitle: 'व्यापक सर्वेक्षण पोर्टल',
    description: 'Digital platform for efficient data collection and management',
    bgImage: '/app_back.jpg',
  },
];

export default function LandingPage() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

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

  // Animate statistics on scroll
  useEffect(() => {
    const observerOptions = {
      threshold: 0.5,
      rootMargin: '0px',
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const statNumbers = entry.target.querySelectorAll('.stat-number');
          statNumbers.forEach((stat) => {
            const target = parseInt(stat.getAttribute('data-target') || '0');
            const duration = 2000;
            const increment = target / (duration / 16);
            let current = 0;

            const updateStat = () => {
              current += increment;
              if (current < target) {
                stat.textContent = Math.floor(current).toLocaleString();
                requestAnimationFrame(updateStat);
              } else {
                stat.textContent = target.toLocaleString();
              }
            };
            updateStat();
          });
          observer.unobserve(entry.target);
        }
      });
    }, observerOptions);

    const statsSection = document.querySelector('.stats-section');
    if (statsSection) {
      observer.observe(statsSection);
    }

    return () => observer.disconnect();
  }, []);

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
              <Link href="/public" className="btn btn-outline-light btn-sm me-2">
                Public Survey
              </Link>
              <Link href="/login" className="btn btn-light btn-sm">
                Admin Login
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
                      Admin Portal
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

      {/* About Section */}
      <section className="landing-section about-section">
        <div className="container">
          <div className="row align-items-center">
            <div className="col-lg-6">
              <div className="section-image">
                <img src={LOGO_URL} alt="DDRC" className="img-fluid rounded shadow-lg" />
              </div>
            </div>
            <div className="col-lg-6">
              <div className="section-content">
                <h2 className="section-title">
                  About DDRC Ahilyanagar
                  <span className="section-title-marathi">जिल्हा दिव्यांग पुनर्वसन केंद्र, अहिल्यानगर</span>
                </h2>
                <p className="section-text">
                  The District Disability Rehabilitation Centre (DDRC) Ahilyanagar is a government-approved 
                  institution dedicated to providing comprehensive rehabilitation services to persons with 
                  disabilities. Established under the Ministry of Social Justice & Empowerment, Government of India, 
                  we work towards empowering individuals with disabilities through various programs and services.
                </p>
                <p className="section-text">
                  Our mission is to ensure that every person with a disability receives the support, care, and 
                  opportunities they deserve to lead a dignified and independent life.
                </p>
                <div className="section-features">
                  <div className="feature-item">
                    <i className="bi bi-check-circle-fill text-primary"></i>
                    <span>Government Approved</span>
                  </div>
                  <div className="feature-item">
                    <i className="bi bi-check-circle-fill text-primary"></i>
                    <span>Comprehensive Services</span>
                  </div>
                  <div className="feature-item">
                    <i className="bi bi-check-circle-fill text-primary"></i>
                    <span>Digital Platform</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="landing-section services-section">
        <div className="container">
          <div className="section-header text-center mb-5">
            <h2 className="section-title">
              Our Services
              <span className="section-title-marathi">आमच्या सेवा</span>
            </h2>
            <p className="section-subtitle">
              Comprehensive rehabilitation and support services for persons with disabilities
            </p>
          </div>
          <div className="row g-4">
            <div className="col-md-4">
              <div className="service-card">
                <div className="service-icon">
                  <i className="bi bi-clipboard-data"></i>
                </div>
                <h3 className="service-title">Survey & Assessment</h3>
                <p className="service-text">
                  Comprehensive disability surveys and assessments to identify needs and provide 
                  appropriate support services.
                </p>
              </div>
            </div>
            <div className="col-md-4">
              <div className="service-card">
                <div className="service-icon">
                  <i className="bi bi-person-check"></i>
                </div>
                <h3 className="service-title">Rehabilitation Services</h3>
                <p className="service-text">
                  Professional rehabilitation services including physical therapy, occupational 
                  therapy, and counseling support.
                </p>
              </div>
            </div>
            <div className="col-md-4">
              <div className="service-card">
                <div className="service-icon">
                  <i className="bi bi-file-earmark-text"></i>
                </div>
                <h3 className="service-title">Documentation & Certification</h3>
                <p className="service-text">
                  Assistance with disability certificates, UDID registration, and other 
                  essential documentation processes.
                </p>
              </div>
            </div>
            <div className="col-md-4">
              <div className="service-card">
                <div className="service-icon">
                  <i className="bi bi-award"></i>
                </div>
                <h3 className="service-title">Scheme Benefits</h3>
                <p className="service-text">
                  Guidance and support for accessing various government schemes and benefits 
                  available for persons with disabilities.
                </p>
              </div>
            </div>
            <div className="col-md-4">
              <div className="service-card">
                <div className="service-icon">
                  <i className="bi bi-people"></i>
                </div>
                <h3 className="service-title">Community Support</h3>
                <p className="service-text">
                  Community-based rehabilitation programs and support groups to foster 
                  inclusion and empowerment.
                </p>
              </div>
            </div>
            <div className="col-md-4">
              <div className="service-card">
                <div className="service-icon">
                  <i className="bi bi-phone"></i>
                </div>
                <h3 className="service-title">Digital Platform</h3>
                <p className="service-text">
                  Modern digital platform for easy access to services, online surveys, and 
                  efficient data management.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Statistics Section */}
      <section className="landing-section stats-section">
        <div className="container">
          <div className="section-header text-center mb-5">
            <h2 className="section-title text-white">
              Our Impact
              <span className="section-title-marathi">आमचा प्रभाव</span>
            </h2>
          </div>
          <div className="row g-4">
            <div className="col-md-3 col-sm-6">
              <div className="stat-card">
                <div className="stat-icon">
                  <i className="bi bi-people-fill"></i>
                </div>
                <div className="stat-number" data-target="10000">0</div>
                <div className="stat-label">Beneficiaries Served</div>
              </div>
            </div>
            <div className="col-md-3 col-sm-6">
              <div className="stat-card">
                <div className="stat-icon">
                  <i className="bi bi-clipboard-check"></i>
                </div>
                <div className="stat-number" data-target="5000">0</div>
                <div className="stat-label">Surveys Completed</div>
              </div>
            </div>
            <div className="col-md-3 col-sm-6">
              <div className="stat-card">
                <div className="stat-icon">
                  <i className="bi bi-award-fill"></i>
                </div>
                <div className="stat-number" data-target="3000">0</div>
                <div className="stat-label">Certificates Issued</div>
              </div>
            </div>
            <div className="col-md-3 col-sm-6">
              <div className="stat-card">
                <div className="stat-icon">
                  <i className="bi bi-heart-fill"></i>
                </div>
                <div className="stat-number" data-target="95">0</div>
                <div className="stat-label">% Satisfaction</div>
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
                Admin Portal Login
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
                <li><Link href="/login">Admin Login</Link></li>
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
              <p className="text-muted">
                Powered by <span className="text-danger">UTK</span>RRANTI
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
