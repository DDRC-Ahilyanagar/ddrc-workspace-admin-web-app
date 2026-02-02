'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import 'animate.css';

const LOGO_URL = '/ddrc app icon (192 x 192 px) (1024 x 1024 px)(1).png';
const SUPPORT_IMG = '/about.jpg';

// --- Types & Content ---

type Content = {
  hero: { title: string; subtitle: string; cta: string };
  stats: { label: string; value: string }[];
  about: { title: string; description: string; tag: string };
  process: { title: string; steps: { title: string; desc: string; icon: string }[] };
  benefits: { title: string; items: string[] };
  documents: { title: string; subtitle: string; list: string[] };
  download: { title: string; subtitle: string; cta: string; info: string };
  footer: { slogan: string; closing: string; contact: string; links: string[] };
};

const content: Record<'mr' | 'en', Content> = {
  mr: {
    hero: {
      title: 'दिव्यांग सर्वेक्षण अभियान – २०२६',
      subtitle: 'जिल्हा प्रशासन, अहिल्यानगर व जिल्हा दिव्यांग पुनर्वसन केंद्र यांचा संयुक्त उपक्रम. आपण सर्वांनी मिळून एका समावेशक समाजाची निर्मिती करूया.',
      cta: 'सर्वेक्षण सुरू करा',
    },
    stats: [
      { label: 'गावे', value: '1,500+' },
      { label: 'तालुके', value: '14' },
      { label: 'क्षेत्रीय अधिकारी', value: '100+' },
      { label: 'पडताळणी अधिकारी', value: '50+' },
      { label: 'लाभार्थी (सर्वेक्षण)', value: '5,000+' },
    ],
    about: {
      tag: 'आमचे ध्येय',
      title: 'प्रत्येक दिव्यांगाला ओळख आणि अधिकार मिळवून देणे',
      description: 'अहिल्यानगर जिल्ह्यातील सर्व दिव्यांग बांधवांचे अचूक, अद्ययावत व विश्वासार्ह माहिती संकलित करण्यासाठी हे विशेष सर्वेक्षण राबविण्यात येत आहे. या माहितीच्या आधारे दिव्यांग बांधवांना विविध शासकीय योजना व सेवा प्रभावीपणे उपलब्ध करून देण्यात येणार आहेत.',
    },
    process: {
      title: 'सर्वेक्षण प्रक्रिया',
      steps: [
        {
          title: 'घरोघरी भेट',
          desc: 'आशा सेविका व स्वयंसेवक आपल्या घरी येऊन माहिती घेतील.',
          icon: 'bi-house-door'
        },
        {
          title: 'डिजिटल नोंदणी',
          desc: 'प्रगत मोबाईल ऍपद्वारे अचूक आणि जलद माहिती संकलन.',
          icon: 'bi-phone'
        },
        {
          title: 'पडताळणी',
          desc: 'संकलित माहितीची शासकीय स्तरावर पडताळणी.',
          icon: 'bi-check-circle'
        }
      ]
    },
    benefits: {
      title: 'सर्वेक्षणाचे फायदे',
      items: [
        'शासकीय योजनांचा थेट लाभ',
        'मोफत वैद्यकीय पुनर्वसन सेवा',
        'UDID प्रमाणपत्र काढण्यास मदत',
        'स्वयंरोजगारासाठी अर्थसहाय्य',
        'मोफत सहायक साधने (उदा. व्हिलचेअर)'
      ]
    },
    documents: {
      title: 'आवश्यक कागदपत्रे',
      subtitle: 'नोंदणीसाठी खालील कागदपत्रे तयार ठेवा:',
      list: [
        'दिव्यांग प्रमाणपत्र (UDID)',
        'आधार कार्ड',
        'रेशन कार्ड',
        'निवडणूक ओळखपत्र',
        'बँक पासबुक'
      ]
    },
    download: {
      title: 'आमचे मोबाईल ऍप डाउनलोड करा',
      subtitle: 'आमचे क्षेत्रीय अधिकाऱ्यांसाठी असलेले मोबाईल ऍप डाउनलोड करा',
      cta: 'प्ले स्टोअरवरून डाउनलोड करा',
      info: 'क्षेत्रीय अधिकाऱ्यांसाठी अनिवार्य'
    },
    footer: {
      slogan: 'समर्थ भारत, सक्षम दिव्यांग',
      closing: 'एकत्र येऊया – सक्षम, समावेशक आणि संवेदनशील समाज घडवूया.',
      contact: '०२४१ २७७ ७७७२',
      links: ['गोपनीयता धोरण', 'नियम व अटी', 'मदत']
    }
  },
  en: {
    hero: {
      title: 'Divyang Survey Campaign 2026',
      subtitle: 'A prestigious joint initiative by the District Administration of Ahilyanagar and DDRC. Building an inclusive future, together.',
      cta: 'Start Survey',
    },
    stats: [
      { label: 'Population Covered', value: '45L+' },
      { label: 'Beneficiaries', value: '1.2L+' },
      { label: 'Villages', value: '1,500+' },
      { label: 'Field Officers', value: '5,000+' },
    ],
    about: {
      tag: 'OUR MISSION',
      title: 'Empowering Lives Through Data',
      description: 'Executing a comprehensive data-driven initiative to maintain accurate and reliable demographics for every person with disabilities in the district, ensuring targeted delivery of government welfare and support services.',
    },
    process: {
      title: 'How It Works',
      steps: [
        {
          title: 'Door-to-Door',
          desc: 'Certified workers visit homes for data collection.',
          icon: 'bi-house-door'
        },
        {
          title: 'Digital Entry',
          desc: 'Seamless registration via our secure mobile app.',
          icon: 'bi-phone'
        },
        {
          title: 'Verification',
          desc: 'Multi-level official verification for authenticity.',
          icon: 'bi-check-circle'
        }
      ]
    },
    benefits: {
      title: 'Key Benefits',
      items: [
        'Direct Government Scheme Benefits',
        'Free Medical Rehabilitation Services',
        'Assistance for UDID Card',
        'Self-Employment Financial Aid',
        'Free Assistive Devices (e.g. Wheelchair)'
      ]
    },
    documents: {
      title: 'Required Documents',
      subtitle: 'Please keep these ready for registration:',
      list: [
        'Disability Certificate (UDID)',
        'Aadhaar Card',
        'Ration Card',
        'Voter ID',
        'Bank Passbook'
      ]
    },
    download: {
      title: 'Download Our Mobile App',
      subtitle: 'Field officers can now conduct surveys faster and more accurately using our official mobile application.',
      cta: 'Download from Play Store',
      info: 'Mandatory for Field Officers'
    },
    footer: {
      slogan: 'Empowered People, Inclusive Society',
      closing: 'Together, let us build a barrier-free, inclusive, and compassionate society.',
      contact: '0241 277 7772',
      links: ['Privacy Policy', 'Terms of Service', 'Support']
    }
  }
};

// --- Components ---

const ScrollReveal = ({ children, className = '', animation = 'animate__fadeInUp', delay = '0s' }: { children: React.ReactNode, className?: string, animation?: string, delay?: string }) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`${className} ${isVisible ? `animate__animated ${animation}` : 'opacity-0'}`} style={{ animationDelay: delay }}>
      {children}
    </div>
  );
};

export default function LandingPage() {
  const [lang, setLang] = useState<'mr' | 'en'>('mr');
  const [scrolled, setScrolled] = useState(false);
  const t = content[lang];

  const downloadRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);

    // Scroll to download section if requested
    const params = new URLSearchParams(window.location.search);
    if (params.get('scrollToDownload') === 'true' && downloadRef.current) {
      setTimeout(() => {
        downloadRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 500);
    }

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleDownload = () => {
    const playStoreUrl = "https://play.google.com/store/apps/details?id=com.utkrranti.ddrc.ahilyanagar&pcampaignid=web_share";
    // Standard Android Intent to open app if installed, else fallback to market
    const intentUrl = "intent://#Intent;package=com.utkrranti.ddrc.ahilyanagar;end";

    // Attempt to open the app
    window.location.href = intentUrl;

    // Fallback to Play Store after a delay if the app didn't open
    setTimeout(() => {
      window.location.href = playStoreUrl;
    }, 1500);
  };

  return (
    <div className="min-h-screen font-sans text-slate-900 bg-white overflow-x-hidden">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;700;900&display=swap');
        :root {
          --primary: #003f86;
          --primary-dark: #002d60;
          --secondary: #009cc5;
          --accent: #3eac53;
        }
        body { font-family: 'Outfit', sans-serif; }
      `}</style>

      {/* --- Navbar --- */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? 'bg-white/80 backdrop-blur-md shadow-sm py-3' : 'bg-transparent py-5'}`}>
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-3 no-underline">
            <div className="w-12 h-12 bg-gradient-to-br from-[#003f86] to-[#009cc5] rounded-2xl flex items-center justify-center shadow-lg transform rotate-3 hover:rotate-0 transition-transform duration-500">
              <img src={LOGO_URL} alt="Logo" className="w-8 h-8 object-contain brightness-0 invert" />
            </div>
            <div>
              <h1 className={`font-bold text-xl leading-none tracking-tight transition-colors ${scrolled ? 'text-slate-800' : 'text-white'}`}>DDRC</h1>
              <p className={`text-[10px] font-bold tracking-[0.2em] uppercase transition-colors ${scrolled ? 'text-[#003f86]' : 'text-[#00E5FF]'}`}>Ahilyanagar</p>
            </div>
          </Link>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setLang(l => l === 'mr' ? 'en' : 'mr')}
              className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-colors uppercase tracking-wide ${scrolled ? 'border-slate-200 text-slate-600 hover:bg-slate-50' : 'border-white/30 text-white hover:bg-white/10'}`}
            >
              {lang === 'mr' ? 'English' : 'मराठी'}
            </button>
          </div>
        </div>
      </nav>

      {/* --- Hero Section --- */}
      <header className="relative min-h-screen flex items-center justify-center pt-20 overflow-hidden bg-slate-900">
        <div className="absolute top-0 left-0 w-full h-full z-0">
          <video
            autoPlay
            muted
            loop
            playsInline
            className="absolute top-0 left-0 w-full h-full object-cover opacity-60"
          >
            <source src="/District_Disability_Rehabilitation_Center_DDRC_1080P.mp4" type="video/mp4" />
          </video>
          {/* Brand Gradient Overlay */}
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-[#003f86]/90 via-[#003f86]/60 to-[#009cc5]/80 mix-blend-multiply"></div>
          <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-slate-950 via-transparent to-transparent"></div>
        </div>

        <div className="relative z-10 container mx-auto px-6 text-center">
          <ScrollReveal animation="animate__fadeInDown">
            <div className="inline-block mb-8 px-6 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-[#00E5FF] text-sm font-black uppercase tracking-[0.2em] shadow-2xl">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#00E5FF] mr-3 animate-pulse shadow-[0_0_10px_#00E5FF]"></span>
              Official Government Survey 2026
            </div>
          </ScrollReveal>

          <ScrollReveal delay="0.2s">
            <h1 className="text-5xl md:text-7xl lg:text-9xl font-black text-white mb-8 leading-[0.9] tracking-tighter drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
              {t.hero.title}
            </h1>
          </ScrollReveal>

          <ScrollReveal delay="0.4s">
            <p className="text-xl md:text-2xl text-white/80 max-w-3xl mx-auto mb-12 leading-relaxed font-medium drop-shadow-md">
              {t.hero.subtitle}
            </p>
          </ScrollReveal>

          <ScrollReveal delay="0.6s">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <Link href="/public/survey" className="w-full sm:w-auto px-12 py-6 bg-[#009cc5] hover:bg-[#003f86] text-white rounded-2xl font-black text-xl shadow-[0_20px_50px_rgba(0,156,197,0.4)] hover:shadow-[0_20px_50px_rgba(0,63,134,0.4)] hover:-translate-y-1 transition-all flex items-center justify-center gap-3 group no-underline">
                {t.hero.cta}
                <i className="bi bi-arrow-right group-hover:translate-x-1 transition-transform"></i>
              </Link>
              <Link href="/field-officer/signup" className="w-full sm:w-auto px-12 py-6 bg-white/10 backdrop-blur-md text-white border border-white/20 rounded-2xl font-black text-xl hover:bg-[#009cc5] hover:border-[#009cc5] transition-all no-underline">
                {lang === 'mr' ? 'नोंदणी करा' : 'Register Now'}
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </header >

      {/* --- Stats Banner --- */}
      < section className="py-10 bg-slate-900 text-white -mt-20 relative z-20 mx-4 md:mx-10 rounded-3xl shadow-2xl" >
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center divide-x divide-white/10">
            {t.stats.map((stat, i) => (
              <ScrollReveal key={i} delay={`${i * 0.1}s`}>
                <div className="p-2">
                  <div className="text-3xl md:text-4xl font-black text-[#009cc5] mb-1">{stat.value}</div>
                  <div className="text-xs md:text-sm font-medium text-slate-400 uppercase tracking-wider">{stat.label}</div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section >

      {/* --- About Section --- */}
      < section className="py-24 px-6 md:px-12 bg-white" >
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <ScrollReveal animation="animate__fadeInLeft">
            <div className="relative">
              <div className="absolute -inset-4 bg-[#E1F5FE] rounded-[3rem] transform -rotate-2"></div>
              <img src={SUPPORT_IMG} alt="About" className="relative rounded-[2.5rem] shadow-2xl w-full object-cover h-[500px]" />
              <div className="absolute bottom-10 -right-10 bg-white p-6 rounded-2xl shadow-xl max-w-xs hidden md:block animate__animated animate__fadeInUp animate__delay-1s">
                <p className="font-bold text-slate-900 text-lg">"Empowerment starts with recognition."</p>
                <p className="text-slate-500 text-sm mt-2">- District Collector</p>
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal animation="animate__fadeInRight">
            <div>
              <span className="text-[#003f86] font-bold uppercase tracking-widest text-sm mb-2 block">{t.about.tag}</span>
              <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-6 leading-tight">{t.about.title}</h2>
              <p className="text-slate-600 text-lg leading-relaxed mb-8">
                {t.about.description}
              </p>
              <ul className="space-y-4">
                {t.benefits.items.slice(0, 3).map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#E1F5FE] text-[#3eac53] flex items-center justify-center text-xs">✓</span>
                    <span className="text-slate-700 font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </ScrollReveal>
        </div>
      </section >

      {/* --- Process Section --- */}
      < section className="py-24 bg-slate-50" >
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <ScrollReveal>
              <span className="text-[#003f86] font-bold uppercase tracking-widest text-sm">Workflow</span>
              <h2 className="text-4xl md:text-5xl font-black text-slate-900 mt-2">{t.process.title}</h2>
            </ScrollReveal>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {t.process.steps.map((step, i) => (
              <ScrollReveal key={i} delay={`${i * 0.2}s`} className="h-full">
                <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-lg hover:shadow-xl transition-all hover:border-[#009cc5] h-full flex flex-col items-center text-center group">
                  <div className="w-16 h-16 rounded-2xl bg-teal-50 text-[#003f86] flex items-center justify-center text-2xl mb-6 group-hover:scale-110 group-hover:bg-[#003f86] group-hover:text-white transition-all duration-300">
                    <i className={`bi ${step.icon}`}></i>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">{step.title}</h3>
                  <p className="text-slate-500 leading-relaxed">{step.desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section >

      {/* --- Documents & Requirements --- */}
      < section className="py-24 px-6 relative overflow-hidden" >
        <div className="absolute top-0 right-0 w-1/3 h-full bg-teal-50/50 skew-x-12 transform origin-top-right"></div>
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <ScrollReveal>
              <div className="bg-slate-900 text-white p-10 md:p-14 rounded-[3rem] shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#009cc5]/20 blur-[80px]"></div>
                <h3 className="text-3xl font-black mb-2">{t.documents.title}</h3>
                <p className="text-slate-400 mb-8">{t.documents.subtitle}</p>
                <ul className="space-y-4">
                  {t.documents.list.map((doc, i) => (
                    <li key={i} className="flex items-center gap-4 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                      <span className="w-8 h-8 rounded-lg bg-[#009cc5]/20 text-[#009cc5] flex items-center justify-center text-sm font-bold">{i + 1}</span>
                      <span className="font-medium">{doc}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </ScrollReveal>

            <ScrollReveal animation="animate__fadeInRight" delay="0.2s">
              <div>
                <h3 className="text-3xl font-bold text-slate-900 mb-6">Why Apply Now?</h3>
                <div className="grid gap-4">
                  {t.benefits.items.map((benefit, i) => (
                    <div key={i} className="flex gap-4 items-start">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#E1F5FE] flex items-center justify-center text-[#3eac53] mt-1">
                        <i className="bi bi-star-fill text-xs"></i>
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-lg">{benefit.split(' ').slice(0, 2).join(' ')}...</h4>
                        <p className="text-slate-500 text-sm">{benefit}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-10">
                  <Link href="/public/survey" className="inline-flex items-center gap-2 text-[#3eac53] font-black tracking-wide border-b-2 border-[#009cc5] hover:border-[#003f86] transition-all uppercase text-sm pb-1">
                    {lang === 'mr' ? 'सर्व फायदे पहा' : 'View All Benefits'}
                    <i className="bi bi-arrow-right"></i>
                  </Link>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section >

      {/* --- Download App Section --- */}
      <section ref={downloadRef} className="py-24 px-6 bg-gradient-to-br from-[#003f86] to-[#009cc5] text-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <ScrollReveal animation="animate__fadeInUp">
            <div className="w-24 h-24 bg-white/20 backdrop-blur-md rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-xl border border-white/30">
              <i className="bi bi-phone-vibrate text-5xl"></i>
            </div>
            <h2 className="text-4xl md:text-5xl font-black mb-6 tracking-tight">{t.download.title}</h2>
            <p className="text-xl text-blue-50/80 mb-12 max-w-2xl mx-auto leading-relaxed">
              {t.download.subtitle}
            </p>
            <div className="flex flex-col items-center gap-4">
              <button
                onClick={handleDownload}
                className="px-10 py-5 bg-white text-[#003f86] rounded-2xl font-black text-xl shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center gap-3 group"
              >
                <i className="bi bi-google-play text-2xl"></i>
                {t.download.cta}
              </button>
              <span className="text-sm font-bold uppercase tracking-[0.2em] opacity-60">
                {t.download.info}
              </span>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* --- Footer --- */}
      <footer className="bg-slate-950 text-white pt-20 pb-10 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <ScrollReveal>
            <h2 className="text-3xl md:text-5xl font-black mb-6 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[#009cc5] to-white">{t.footer.slogan}</h2>
            <p className="text-slate-400 mb-10 max-w-2xl mx-auto">{t.footer.closing}</p>
            <div className="flex justify-center gap-4 mb-16">
              <Link href="/public/survey" className="px-8 py-3 bg-[#003f86] hover:bg-[#009cc5] text-white rounded-full font-bold transition-all shadow-lg shadow-teal-900/50">
                {t.hero.cta}
              </Link>
            </div>
          </ScrollReveal>

          <div className="flex flex-col md:flex-row justify-between items-center gap-6 text-[10px] text-slate-500 uppercase tracking-widest">
            <div className="flex flex-col items-center md:items-start gap-2">
              <div className="flex items-center gap-2">
                <img src={LOGO_URL} alt="Logo" className="w-5 h-5 brightness-0 invert opacity-50" />
                <span>© 2026 Admin Panel Ahilyanagar</span>
              </div>
              <p className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em]">
                Designed & Engineered by <a href="https://utkrranti.com" target="_blank" rel="noopener noreferrer" className="!no-underline hover:opacity-80 transition-opacity" style={{ textDecoration: 'none' }}>
                  <span className="text-white">UT</span>
                  <span className="text-[#FF3D00]">K</span>
                  <span className="text-white">RRANTI</span>
                </a>
              </p>
            </div>
            <div className="flex flex-col sm:flex-row flex-wrap justify-center items-center gap-4 md:gap-8 w-full">
              <div className="flex flex-wrap justify-center gap-4 md:gap-6 mb-4 sm:mb-0">
                {t.footer.links.map((l, i) => <span key={i} className="hover:text-white cursor-pointer transition-colors text-xs opacity-70 whitespace-nowrap">{l}</span>)}
              </div>
              <div className="flex gap-3">
                <Link href="/login" className="px-6 py-2.5 bg-[#003f86] text-white rounded-[12px] no-underline hover:bg-[#009cc5] transition-all font-black text-[10px] uppercase tracking-wider shadow-lg shadow-teal-900/40 active:scale-95 whitespace-nowrap">
                  {lang === 'mr' ? 'लॉगिन' : 'Staff Login'}
                </Link>
                <Link href="/field-officer/signup" className="px-6 py-2.5 bg-slate-800 text-white rounded-[12px] no-underline hover:bg-slate-700 transition-all font-black text-[10px] uppercase tracking-wider border border-slate-700 active:scale-95 whitespace-nowrap">
                  {lang === 'mr' ? 'नोंदणी' : 'Registration'}
                </Link>
              </div>
            </div>
            <div className="text-[#009cc5] font-mono">
              Helpline: {t.footer.contact}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
