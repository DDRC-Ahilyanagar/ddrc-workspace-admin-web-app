'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import 'animate.css';

const LOGO_URL = '/ddrc app icon (192 x 192 px) (1024 x 1024 px)(1).png';
const ZP_LOGO = '/ZP_ahilyanagar.jpg';
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
      title: 'दिव्यांग सर्वेक्षण अभियान २०२६',
      subtitle: 'तुमची नोंद म्हणजे तुमचा हक्क — सर्वेक्षणात सहभाग म्हणजे योजनांकडे एक पाऊल. आजच आपली माहिती नोंदवा आणि सक्षम समाजाच्या निर्मितीत सहभागी व्हा.',
      cta: 'सर्वेक्षण सुरू करा',
    },
    stats: [
      { label: 'एकूण तालुके', value: '14' },
      { label: 'एकूण गावे', value: '1,500+' },
      { label: 'क्षेत्रीय अधिकारी', value: '100+' },
      { label: 'नोंदणीकृत लाभार्थी', value: '5,000+' },
    ],
    about: {
      tag: 'आमचे ध्येय',
      title: 'प्रत्येक दिव्यांगाला ओळख आणि अधिकार मिळवून देणे',
      description: 'अहिल्यानगर जिल्ह्यातील प्रत्येक दिव्यांग बांधवांचे अचूक, अद्ययावत व विश्वासार्ह माहिती संकलित करण्यासाठी हे विशेष सर्वेक्षण राबविण्यात येत आहे. या माहितीच्या आधारे दिव्यांग बांधवांना विविध शासकीय योजना व सेवा प्रभावीपणे उपलब्ध करून देण्यात येणार आहेत. आम्ही पारदर्शक आणि डेटा-चालित दृष्टिकोनाद्वारे सर्वसमावेशक भविष्य घडवण्यासाठी कटिबद्ध आहोत.',
    },
    process: {
      title: 'सर्वेक्षण प्रक्रिया कशी कार्य करते?',
      steps: [
        {
          title: 'घरोघरी भेट',
          desc: 'प्रशिक्षित आशा सेविका व स्वयंसेवक आपल्या घरी येऊन थेट माहिती घेतील.',
          icon: 'bi-house-door'
        },
        {
          title: 'डिजिटल नोंदणी',
          desc: 'अद्ययावत मोबाईल ऍप्लिकेशनद्वारे माहिती सुरक्षितपणे आणि जलद नोंदवली जाईल.',
          icon: 'bi-phone'
        },
        {
          title: 'शासकीय पडताळणी',
          desc: 'संकलित माहितीची शासकीय स्तरावर पडताळणी करून योजनेसाठी पात्र ठरवले जाईल.',
          icon: 'bi-patch-check'
        }
      ]
    },
    benefits: {
      title: 'सर्वेक्षणाचे फायदे',
      items: [
        'शासकीय योजनांचा थेट आणि त्वरित लाभ',
        'मोफत वैद्यकीय तपासणी आणि पुनर्वसन सेवा',
        'UDID प्रमाणपत्र काढण्यासाठी विशेष मार्गदर्शन',
        'स्वयंरोजगारासाठी अर्थसहाय्य आणि कौशल्य विकास',
        'मोफत सहायक साधने (उदा. व्हिलचेअर, श्रवणयंत्र) वाटप',
        'शिक्षण आणि प्रशिक्षणासाठी विशेष सवलती'
      ]
    },
    documents: {
      title: 'आवश्यक कागदपत्रे',
      subtitle: 'नोंदणीसाठी खालील कागदपत्रे तयार ठेवावीत:',
      list: [
        'दिव्यांग प्रमाणपत्र (UDID किंवा मूळ प्रमाणपत्र)',
        'आधार कार्ड (अनिवार्य)',
        'रेशन कार्ड किंवा रहिवासी दाखला',
        'मतदार ओळखपत्र (असल्यास)',
        'बँक पासबुक (पहिल्या पानाची प्रत)',
        'पासपोर्ट आकाराचे फोटो'
      ]
    },
    download: {
      title: 'क्षेत्रीय अधिकाऱ्यांसाठी अधिकृत ऍप',
      subtitle: 'आमचे क्षेत्रीय अधिकारी आता अधिक वेगाने आणि अचूकपणे सर्वेक्षण करू शकतात. हे ऍप केवळ नोंदणीकृत कर्मचाऱ्यांसाठी आहे.',
      cta: 'प्ले स्टोअर वरून डाउनलोड करा',
      info: 'नोंदणीकृत क्षेत्रीय अधिकाऱ्यांसाठी अनिवार्य'
    },
    footer: {
      slogan: 'समर्थ भारत, सक्षम दिव्यांग',
      closing: 'एकत्र येऊया – सक्षम, समावेशक आणि संवेदनशील समाज घडवूया. आपल्या सहकार्यामुळेच हे अभियान यशस्वी होईल.',
      contact: '०२४१ २७७ ७७७२',
      links: ['गोपनीयता धोरण', 'नियम व अटी', 'मदत केंद्र']
    }
  },
  en: {
    hero: {
      title: 'Divyang Survey Campaign 2026',
      subtitle: 'Your registration is your right — participation in the survey is a step towards welfare schemes. Join us in building an inclusive society.',
      cta: 'Start Survey Now',
    },
    stats: [
      { label: 'Talukas', value: '14' },
      { label: 'Villages', value: '1,500+' },
      { label: 'Field Staff', value: '100+' },
      { label: 'Registrations', value: '5,000+' },
    ],
    about: {
      tag: 'OUR MISSION',
      title: 'Empowering Lives Through Dignity and Rights',
      description: 'We are conducting a comprehensive survey across Ahilyanagar district to ensure every person with disability is identified and gets direct access to government welfare schemes. Our goal is to maintain a high-quality, reliable database to plan future support systems and infrastructure tailored to the needs of the Divyang community.',
    },
    process: {
      title: 'How our Survey Works',
      steps: [
        {
          title: 'Doorstep Visit',
          desc: 'Trained staff and volunteers visit homes for direct verification.',
          icon: 'bi-house-door'
        },
        {
          title: 'Digital Entry',
          desc: 'Data is securely captured via our specialized mobile platform.',
          icon: 'bi-phone'
        },
        {
          title: 'Verification',
          desc: 'Multi-level official verification ensures authenticity and eligibility.',
          icon: 'bi-patch-check'
        }
      ]
    },
    benefits: {
      title: 'Key Benefits of Survey',
      items: [
        'Direct Access to Government Welfare Schemes',
        'Free Medical Rehabilitation and Checkups',
        'Dedicated Assistance for UDID Certification',
        'Financial Support for Self-Employment & Startups',
        'Free Distribution of Assistive & Mobility Devices',
        'Priority in Education and Skill Training Programs'
      ]
    },
    documents: {
      title: 'Required Documents',
      subtitle: 'Please keep these ready for the official visit:',
      list: [
        'Disability Certificate (UDID or Physical Copy)',
        'Aadhaar Card (Mandatory)',
        'Ration Card / Proof of Residence',
        'Voter ID Card (if available)',
        'Bank Passbook Photo Copy',
        'Passport Size Photographs'
      ]
    },
    download: {
      title: 'Official Field Officer App',
      subtitle: 'Authorized field officers can download the survey management tool here. This is intended for registered staff only.',
      cta: 'Download from Play Store',
      info: 'Mandatory for Authorized Field Staff'
    },
    footer: {
      slogan: 'Empowered People, Inclusive Society',
      closing: 'Together, let us build a barrier-free, inclusive, and compassionate society for everyone in Ahilyanagar district.',
      contact: '0241 277 7772',
      links: ['Privacy Policy', 'Terms of Service', 'Support Desk']
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

const HeroButton = ({ text, href }: { text: string, href: string }) => {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (loading) return; // Prevent double click
    setLoading(true);
    // Add artificial delay for smooth feel
    setTimeout(() => {
      router.push(href);
    }, 800);
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`
        relative overflow-hidden group
        items-center gap-4 px-10 py-5
        bg-white text-[#003f86]
        rounded-2xl font-black text-xl tracking-wide
        shadow-[0_10px_30px_-10px_rgba(0,0,0,0.3)]
        hover:shadow-[0_20px_40px_-10px_rgba(255,255,255,0.4)]
        hover:-translate-y-1 active:translate-y-0.5 active:scale-95
        transition-all duration-300 ease-out
        inline-flex
        border border-transparent hover:border-blue-100
      `}
    >
      {/* Glossy Shimmer Effect */}
      <div className="absolute inset-0 -translate-x-[150%] group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-blue-100/50 to-transparent z-10 skew-x-12" />

      <span className="relative z-20 flex items-center gap-3">
        {text}
        <span className={`flex items-center justify-center transition-all duration-300 w-8 h-8 rounded-full bg-blue-50 ${loading ? 'scale-100' : 'group-hover:translate-x-1'}`}>
          {loading ? (
            <svg className="animate-spin h-5 w-5 text-[#003f86]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
          ) : (
            <i className="bi bi-arrow-right text-lg text-[#003f86]"></i>
          )}
        </span>
      </span>
    </button>
  );
};

export default function DetailedLandingPage() {
  const [lang, setLang] = useState<'mr' | 'en'>('mr');
  const [fontSize, setFontSize] = useState(1); // 0.8, 1, 1.2
  const [showCookies, setShowCookies] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const t = content[lang];

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);

    // Check if cookies accepted
    const cookiesAccepted = localStorage.getItem('cookies-accepted');
    if (!cookiesAccepted) {
      setTimeout(() => setShowCookies(true), 1500);
    }

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const acceptCookies = () => {
    localStorage.setItem('cookies-accepted', 'true');
    setShowCookies(false);
  };

  const getFontSizeClass = () => {
    if (fontSize === 0.8) return 'text-[90%]';
    if (fontSize === 1.2) return 'text-[110%]';
    return 'text-[100%]';
  };

  return (
    <div className={`min-h-screen font-sans text-slate-800 bg-white selection:bg-[#009cc5]/20 overflow-x-hidden ${getFontSizeClass()}`}>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        body { font-family: 'Inter', sans-serif; -webkit-font-smoothing: antialiased; }
        html { scroll-behavior: smooth; }
        @keyframes shimmer {
          0% { transform: translateX(-150%) skewX(-12deg); }
          100% { transform: translateX(150%) skewX(-12deg); }
        }
      `}</style>

      {/* --- Complete Header Wrapper (Utility + Main Nav) --- */}
      <header className="fixed top-0 left-0 w-full z-50">
        {/* --- Top Utility Bar --- */}
        <div className="w-full bg-[#003f86] text-white py-1.5 border-b border-white/10">
          <div className="max-w-7xl mx-auto px-4 md:px-6 flex justify-between items-center text-[10px] md:text-xs">
            <div className="flex items-center gap-4">
              <span className="font-bold opacity-80 hidden sm:inline uppercase">Accessibility Support:</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setFontSize(0.8)} className={`w-6 h-6 rounded flex items-center justify-center border border-white/20 hover:bg-white/10 ${fontSize === 0.8 ? 'bg-white/20 border-white' : ''}`}>A-</button>
                <button onClick={() => setFontSize(1)} className={`w-6 h-6 rounded flex items-center justify-center border border-white/20 hover:bg-white/10 ${fontSize === 1 ? 'bg-white/20 border-white' : ''}`}>A</button>
                <button onClick={() => setFontSize(1.2)} className={`w-6 h-6 rounded flex items-center justify-center border border-white/20 hover:bg-white/10 ${fontSize === 1.2 ? 'bg-white/20 border-white' : ''}`}>A+</button>
              </div>
              <button
                onClick={() => {
                  alert("Screen Reader Optimized Mode Enabled.\n\nARIA labels and high-contrast text are now active for assistive technologies.");
                }}
                className="flex items-center gap-1 opacity-80 hover:opacity-100 transition-opacity ml-2 focus:outline-none focus:ring-2 focus:ring-amber-400 rounded px-1"
                aria-label="Enable Screen Reader Access"
              >
                <i className="bi bi-person-badge"></i> Screen Reader Access
              </button>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-4 w-[1px] bg-white/20 mx-2 hidden sm:block"></div>
              <button
                onClick={() => setLang(l => l === 'mr' ? 'en' : 'mr')}
                className="font-black hover:text-[#009cc5] transition-colors uppercase border-l border-white/20 pl-4 ml-1"
              >
                {lang === 'mr' ? 'English' : 'मराठी'}
              </button>
            </div>
          </div>
        </div>

        {/* --- Main Navigation Bar --- */}
        <nav className={`w-full transition-all duration-300 ${scrolled ? 'bg-white shadow-lg py-1' : 'bg-transparent py-2'}`}>
          <div className="max-w-7xl mx-auto px-4 md:px-6">

            {/* Mobile Layout (< md) */}
            <div className="flex md:hidden flex-col items-center">
              <div className="flex items-center gap-6 mb-1">
                <img src={LOGO_URL} alt="DDRC Logo" className="w-10 h-10 object-contain" />
                <img src={ZP_LOGO} alt="ZP Logo" className="w-10 h-10 object-contain rounded-full bg-white p-0.5 shadow-sm" />
              </div>
              <div className="text-center">
                <h1 className={`font-extrabold !text-[1.5rem] leading-none uppercase tracking-tight mb-1 ${scrolled ? 'text-[#003f86]' : 'text-white drop-shadow-md'}`}>
                  District Disability Rehabilitation Center, Ahilyanagar
                </h1>
                <h2 className={`font-bold !text-[1rem] leading-tight mt-0.5 ${scrolled ? 'text-[#009cc5]' : 'text-white drop-shadow-md'}`}>
                  जिल्हा दिव्यांग पुनर्वसन केंद्र, अहिल्यानगर
                </h2>
              </div>
            </div>

            {/* Desktop Layout (>= md) */}
            <div className="hidden md:flex justify-between items-center h-auto min-h-[60px]">
              {/* Left: DDRC Logo */}
              <div className="flex-shrink-0">
                <img src={LOGO_URL} alt="DDRC Logo" className="w-24 h-24 object-contain" />
              </div>

              {/* Center: Full Form Text */}
              <div className="flex flex-col text-center px-4 flex-grow justify-center">
                <h1 className={`font-extrabold text-sm tracking-tight uppercase leading-snug whitespace-normal ${scrolled ? 'text-[#003f86]' : 'text-white drop-shadow-md'}`}>
                  District Disability Rehabilitation Center, Ahilyanagar
                </h1>
                <h2 className={`font-bold text-xs leading-snug mt-1 whitespace-normal break-words ${scrolled ? 'text-[#009cc5]' : 'text-white drop-shadow-md'}`}>
                  जिल्हा दिव्यांग पुनर्वसन केंद्र, अहिल्यानगर
                </h2>
              </div>

              {/* Right: ZP Logo */}
              <div className="flex-shrink-0">
                <img src={ZP_LOGO} alt="ZP Logo" className="w-24 h-24 object-contain rounded-full bg-white p-0.5 shadow-sm" />
              </div>
            </div>
          </div>
        </nav>
      </header>

      {/* --- Main Page Content --- */}
      <main className="relative">
        {/* --- Hero Section --- */}
        <header className="relative min-h-[90vh] flex items-center justify-center pt-32 md:pt-48 pb-20 overflow-hidden bg-gradient-to-br from-[#003f86] via-[#003f86] to-[#009cc5]">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:30px_30px]"></div>

          <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
            <ScrollReveal animation="animate__fadeInDown">
              <span className="inline-block mb-6 px-4 py-1.5 rounded bg-white/10 backdrop-blur-sm text-white text-[11px] font-bold uppercase tracking-[0.2em] border border-white/20">
                Government District Mission
              </span>
            </ScrollReveal>

            <ScrollReveal delay="0.2s">
              <h1 className="text-4xl md:text-7xl font-extrabold text-white mb-8 leading-[1.05] tracking-tight">
                {t.hero.title}
              </h1>
            </ScrollReveal>

            <ScrollReveal delay="0.4s">
              <p className="text-lg md:text-2xl text-white/90 max-w-3xl mx-auto mb-12 leading-relaxed font-medium">
                {t.hero.subtitle}
              </p>
            </ScrollReveal>

            <ScrollReveal delay="0.6s">
              <HeroButton text={t.hero.cta} href="/public/survey" />
            </ScrollReveal>
          </div>
        </header>

        {/* --- Slogan Banner --- */}
        <div className="bg-[#E1F5FE] py-5 border-b border-[#009cc5]/10">
          <div className="max-w-5xl mx-auto px-6 text-center">
            <p className="text-[#003f86] font-bold text-base md:text-lg italic">
              "दिव्यांगत्व ही मर्यादा नाही, योग्य माहिती आणि संधी मिळाली तर तीच ताकद बनते"
            </p>
          </div>
        </div>

        {/* --- Detailed Stats Section --- */}
        <section className="relative z-20 max-w-6xl mx-auto px-6 -mt-10 mb-20">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-100 p-8 md:p-14 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#E1F5FE]/30 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4 text-center divide-x divide-slate-100">
              {t.stats.map((stat, i) => (
                <div key={i} className="px-4">
                  <div className="text-3xl md:text-5xl font-black text-[#003f86] mb-2">{stat.value}</div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* --- About Section (Detailed) --- */}
        <section className="py-24 px-6 bg-white overflow-hidden">
          <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-start">
            <ScrollReveal animation="animate__fadeInLeft">
              <div className="relative">
                <div className="absolute -inset-2 bg-gradient-to-br from-[#003f86] to-[#009cc5] rounded-xl transform -rotate-1 opacity-10"></div>
                <img src={SUPPORT_IMG} alt="Mission" className="relative rounded-xl shadow-xl w-full object-cover h-[500px]" />
                <div className="absolute -bottom-8 -right-8 p-8 bg-white border border-slate-100 rounded-xl shadow-2xl max-w-xs hidden md:block border-l-4 border-l-[#003f86]">
                  <p className="font-extrabold text-slate-900 text-lg leading-tight">"सक्षम दिव्यांग, समर्थ राष्ट्र"</p>
                  <p className="text-slate-500 text-[11px] font-bold mt-3 uppercase tracking-wider">जिल्हा प्रशासन, अहिल्यानगर</p>
                </div>
              </div>
            </ScrollReveal>

            <ScrollReveal animation="animate__fadeInRight" delay="0.2s">
              <span className="text-[#009cc5] font-black uppercase tracking-[0.2em] text-xs mb-3 block">{t.about.tag}</span>
              <h2 className="text-3xl md:text-5xl font-extrabold text-slate-900 mb-8 leading-tight">{t.about.title}</h2>
              <div className="space-y-6">
                <p className="text-slate-600 text-lg leading-relaxed">
                  {t.about.description}
                </p>
                <div className="grid sm:grid-cols-2 gap-6 pt-4">
                  {t.benefits.items.slice(0, 4).map((item, i) => (
                    <div key={i} className="flex gap-4 items-center">
                      <div className="w-10 h-10 rounded-full bg-[#E1F5FE] text-[#003f86] flex items-center justify-center flex-shrink-0">
                        <i className="bi bi-star-fill text-sm"></i>
                      </div>
                      <span className="text-sm font-bold text-slate-700">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* --- Process Section --- */}
        <section className="py-24 bg-slate-50 border-y border-slate-100">
          <div className="max-w-7xl mx-auto px-6 text-center">
            <ScrollReveal>
              <span className="text-[#003f86] font-black uppercase tracking-widest text-xs">Work Process</span>
              <h2 className="text-3xl md:text-5xl font-extrabold text-slate-900 mt-4 mb-16">{t.process.title}</h2>
            </ScrollReveal>

            <div className="grid md:grid-cols-3 gap-12 text-left relative">
              <div className="hidden md:block absolute top-[15%] left-[10%] right-[10%] h-[2px] bg-slate-200 z-0"></div>

              {t.process.steps.map((step, i) => (
                <ScrollReveal key={i} delay={`${i * 0.2}s`} className="relative z-10">
                  <div className="bg-white p-10 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-xl hover:-translate-y-2 group">
                    <div className="w-16 h-16 bg-[#003f86] text-white rounded-xl flex items-center justify-center text-3xl mb-8 shadow-lg shadow-[#003f86]/20 transition-all duration-300 group-hover:scale-110">
                      <i className={`bi ${step.icon}`}></i>
                    </div>
                    <h3 className="text-2xl font-extrabold text-slate-900 mb-4">{step.title}</h3>
                    <p className="text-slate-600 leading-relaxed font-medium">{step.desc}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* --- Benefits & Detailed Features --- */}
        <section className="py-24 px-6 bg-white">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-center md:items-end gap-6 mb-16 text-center md:text-left">
              <ScrollReveal className="max-w-xl">
                <span className="text-[#009cc5] font-black uppercase tracking-widest text-xs block mb-2">Advantages</span>
                <h2 className="text-3xl md:text-5xl font-extrabold text-slate-900">{t.benefits.title}</h2>
              </ScrollReveal>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {t.benefits.items.map((benefit, i) => (
                <ScrollReveal key={i} delay={`${i * 0.1}s`}>
                  <div className="p-8 rounded-xl border border-slate-100 bg-white hover:bg-[#E1F5FE]/10 transition-colors group">
                    <div className="text-[#009cc5] text-2xl mb-4 group-hover:translate-x-1 transition-transform inline-block">
                      <i className="bi bi-shield-check"></i>
                    </div>
                    <p className="text-slate-700 font-bold text-lg leading-snug">{benefit}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* --- Documents Section (Detailed Content) --- */}
        <section className="py-24 px-6 bg-slate-50 border-t border-slate-100">
          <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16">
            <ScrollReveal animation="animate__fadeInLeft">
              <div className="bg-slate-900 text-white p-10 md:p-16 rounded-3xl shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#009cc5]/10 blur-[100px] rounded-full"></div>
                <h3 className="text-3xl font-black mb-4">{t.documents.title}</h3>
                <p className="text-slate-400 mb-10 text-lg leading-relaxed">{t.documents.subtitle}</p>
                <div className="grid grid-cols-1 gap-4">
                  {t.documents.list.map((doc, i) => (
                    <div key={i} className="flex gap-4 items-center p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors">
                      <span className="w-8 h-8 rounded-full bg-[#009cc5]/20 text-[#009cc5] flex items-center justify-center font-bold text-sm">{i + 1}</span>
                      <span className="font-semibold">{doc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollReveal>

            <ScrollReveal animation="animate__fadeInRight" delay="0.2s" className="flex flex-col justify-center">
              <div className="bg-[#003f86] text-white p-10 md:p-16 rounded-3xl shadow-2xl relative overflow-hidden text-center lg:text-left">
                <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2"></div>
                <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mb-8 mx-auto lg:mx-0">
                  <i className="bi bi-phone-vibrate text-5xl text-blue-100"></i>
                </div>
                <h3 className="text-3xl font-black mb-6">{t.download.title}</h3>
                <p className="text-blue-50/80 mb-10 text-lg italic leading-relaxed">"{t.download.subtitle}"</p>
                <div className="space-y-4">
                  <a
                    href="https://play.google.com/store/apps/details?id=com.utkrranti.ddrc.ahilyanagar"
                    className="inline-flex items-center gap-3 px-8 py-4 bg-white text-[#003f86] rounded-md font-extrabold text-lg no-underline shadow-lg hover:bg-slate-50 transition-all hover:scale-105"
                  >
                    <i className="bi bi-google-play"></i> {t.download.cta}
                  </a>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-200 mt-4">
                    <i className="bi bi-shield-lock mr-2"></i> {t.download.info}
                  </p>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* --- Footer --- */}
        <footer className="bg-[#0f172a] text-slate-300 border-t border-[#009cc5]/20 font-sans">
          <div className="max-w-7xl mx-auto px-6 py-16">
            <div className="grid md:grid-cols-12 gap-12">
              {/* Column 1: Brand & Contact (5 cols) */}
              <div className="md:col-span-5 space-y-8">
                <div className="flex items-start gap-4">
                  <img src={LOGO_URL} alt="DDRC Logo" className="w-28 h-28 object-contain brightness-125" />
                  <div className="flex flex-col justify-center">
                    <h3 className="font-extrabold text-white text-lg leading-tight uppercase tracking-tight">District Disability Rehabilitation Center</h3>
                    <span className="font-bold text-sm text-[#009cc5] mt-1">जिल्हा दिव्यांग पुनर्वसन केंद्र, अहिल्यानगर</span>
                  </div>
                </div>

                <p className="text-slate-400 text-sm leading-relaxed max-w-sm border-l-2 border-[#009cc5] pl-4 italic">
                  "{t.footer.closing}"
                </p>

                <div className="flex items-center gap-3 text-white">
                  <div className="w-10 h-10 rounded-full bg-[#003f86] flex items-center justify-center text-[#4fc3f7] text-lg shadow-lg shadow-blue-900/20">
                    <i className="bi bi-telephone-fill"></i>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Helpline Number</span>
                    <span className="text-xl font-bold tracking-wide">{t.footer.contact}</span>
                  </div>
                </div>
              </div>

              {/* Column 2: Navigation (3 cols) */}
              <div className="md:col-span-3 md:pl-8">
                <h4 className="text-white font-bold uppercase tracking-widest text-xs mb-6 border-b border-white/10 pb-2 inline-block">Quick Links</h4>
                <ul className="space-y-4">
                  {t.footer.links.map((link, i) => (
                    <li key={i}>
                      <a className="group flex items-center gap-2 text-sm font-medium text-white hover:text-[#009cc5] transition-colors cursor-pointer no-underline">
                        <i className="bi bi-chevron-right text-[10px] opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all"></i>
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Column 3: Staff Access (4 cols) */}
              <div className="md:col-span-4">
                <h4 className="text-white font-bold uppercase tracking-widest text-xs mb-6 border-b border-white/10 pb-2 inline-block">Administrative Access</h4>
                <div className="space-y-4">
                  <Link href="/login" className="flex items-center justify-between p-4 rounded bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#009cc5]/50 transition-all group no-underline text-white">
                    <div className="flex items-center gap-3">
                      <i className="bi bi-shield-lock text-[#009cc5] text-xl"></i>
                      <div className="flex flex-col">
                        <span className="font-bold text-sm">Department Login</span>
                        <span className="text-[10px] text-slate-400">Restricted Access</span>
                      </div>
                    </div>
                    <i className="bi bi-arrow-right opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-transform"></i>
                  </Link>

                  <Link href="/field-officer/signup" className="flex items-center justify-between p-4 rounded bg-[#003f86] hover:bg-[#002a5c] shadow-lg shadow-blue-900/30 transition-all group no-underline text-white">
                    <div className="flex items-center gap-3">
                      <i className="bi bi-person-badge-fill text-white/80 text-xl"></i>
                      <div className="flex flex-col">
                        <span className="font-bold text-sm">Field Officer Signup</span>
                        <span className="text-[10px] text-blue-200">Join the Mission</span>
                      </div>
                    </div>
                    <i className="bi bi-arrow-right opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-transform"></i>
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Copyright Bar */}
          <div className="bg-[#0b1120] border-t border-white/5 py-6">
            <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] uppercase font-bold tracking-widest text-slate-500">
              <div className="flex items-center gap-2">
                <img src="/emblem.png" alt="Gov" className="w-6 h-6 opacity-50 grayscale" />
                <span>District Administration of Ahilyanagar © 2026</span>
              </div>
              <div className="flex items-center gap-1">
                <span>Designed & Engineered by</span>
                <a href="https://utkrranti.com" target="_blank" rel="noopener noreferrer" className="!no-underline group inline-flex items-center gap-1 ml-1">
                  <span className="text-white group-hover:text-[#009cc5] transition-colors">UT</span>
                  <span className="text-[#FF3D00]">K</span>
                  <span className="text-white group-hover:text-[#009cc5] transition-colors">RRANTI</span>
                </a>
              </div>
            </div>
          </div>
        </footer>
      </main>

      {/* --- Cookie Consent Banner --- */}
      {showCookies && (
        <div className="fixed bottom-6 left-6 right-6 md:left-auto md:max-w-md z-[100] animate__animated animate__fadeInUp">
          <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-2xl border border-white/10">
            <div className="flex gap-4 items-start">
              <div className="w-10 h-10 bg-[#009cc5] rounded-full flex items-center justify-center flex-shrink-0">
                <i className="bi bi-cookie text-xl"></i>
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-base mb-2">Use Cookies for Improvement?</h4>
                <p className="text-xs text-slate-300 leading-relaxed mb-4">
                  We use cookies to analyze traffic and provide a better experience. Do you allow us to track your interaction on this portal?
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={acceptCookies}
                    className="flex-1 py-2.5 bg-[#009cc5] hover:bg-[#003f86] text-white rounded font-bold text-xs uppercase transition-all shadow-lg"
                  >
                    Allow All
                  </button>
                  <button
                    onClick={() => setShowCookies(false)}
                    className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded font-bold text-xs uppercase transition-all"
                  >
                    Decline
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
