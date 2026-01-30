'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const LOGO_URL = '/ddrc app icon (192 x 192 px) (1024 x 1024 px)(1).png';
const SUPPORT_IMG = '/empowerment_support_modern.png';

const content = {
  mr: {
    hero: {
      title: 'दिव्यांग सर्वेक्षण अभियान – २०२६',
      subtitle: 'जिल्हा प्रशासन, अहिल्यानगर व जिल्हा दिव्यांग पुनर्वसन केंद्र यांचा संयुक्त उपक्रम',
      cta: 'नोंदणी सुरू करा',
    },
    about: {
      title: 'अभियानाबद्दल',
      description: 'अहिल्यानगर जिल्ह्यातील सर्व दिव्यांग बांधवांचे अचूक, अद्ययावत व विश्वासार्ह माहिती संकलित करण्यासाठी हे विशेष सर्वेक्षण राबविण्यात येत आहे. या माहितीच्या आधारे दिव्यांग बांधवांना विविध शासकीय योजना व सेवा प्रभावीपणे उपलब्ध करून देण्यात येणार आहेत.',
    },
    process: {
      title: 'नोंदणी प्रक्रिया',
      steps: [
        {
          title: 'प्रशिक्षित कर्मचारी',
          desc: 'सर्वेक्षण आशा सेविका, अंगणवाडी सेविका व प्रशिक्षित स्वयंसेवकांमार्फत घरोघरी जाऊन करण्यात येईल.',
          icon: <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
        },
        {
          title: 'डिजिटल नोंदणी',
          desc: 'यासाठी स्वतंत्र मोबाईल अॅप व अधिकृत वेबसाइट विकसित करण्यात आली आहे.',
          icon: <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
        },
        {
          title: 'संपर्क व पडताळणी',
          desc: 'प्राथमिक माहिती भरल्यानंतर संबंधित व्यक्तीशी गावपातळीवर संपर्क साधून माहितीची नोंद पूर्ण केली जाईल.',
          icon: <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        }
      ]
    },
    benefits: {
      title: 'सर्वेक्षणाचे फायदे',
      items: [
        'शासकीय योजनांचा लाभ',
        'वैद्यकीय पुनर्वसन सेवा',
        'UDID प्रमाणपत्र मदत',
        'स्वयंरोजगाराच्या संधी',
        'सहायक साधने उपलब्ध करणे'
      ]
    },
    documents: {
      title: 'आवश्यक कागदपत्रे',
      subtitle: 'नोंदणीसाठी खालील कागदपत्रे जवळ ठेवावीत:',
      list: [
        'दिव्यांग प्रमाणपत्र (UDID)',
        'आधार कार्ड',
        'रेशन कार्ड',
        'निवडणूक ओळखपत्र',
        'बँक पासबुक'
      ]
    },
    footer: {
      slogan: 'आपला सहभाग – आपल्या हक्कासाठी आवश्यक',
      closing: 'एकत्र येऊया – सक्षम, समावेशक आणि संवेदनशील समाज घडवूया.',
      contact: '०२४१ २७७ ७७७२'
    }
  },
  en: {
    hero: {
      title: 'Divyang Survey Campaign 2026',
      subtitle: 'A prestigious joint initiative by the District Administration of Ahilyanagar and DDRC.',
      cta: 'Start Registration',
    },
    about: {
      title: 'About Campaign',
      description: 'Executing a comprehensive data-driven initiative to maintain accurate and reliable demographics for every person with disabilities in the district, ensuring targeted delivery of government welfare.',
    },
    process: {
      title: 'Workflow',
      steps: [
        {
          title: 'Door-to-Door',
          desc: 'Conducted by certified Asha workers and trained volunteers at the grassroots level.',
          icon: <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
        },
        {
          title: 'Digital Ecosystem',
          desc: 'Advanced mobile applications and web portals designed for seamless data integrity.',
          icon: <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
        },
        {
          title: 'Validation',
          desc: 'Rigorous multi-level verification ensures every record is authentic and verified.',
          icon: <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        }
      ]
    },
    benefits: {
      title: 'Core Objectives',
      items: [
        'Direct Benefit Transfer',
        'Advanced Rehab Services',
        'UDID Facilitation',
        'Self-Employment Support',
        'Assistive Tech Provision'
      ]
    },
    documents: {
      title: 'On-boarding Docs',
      subtitle: 'Please keep digital or physical copies ready:',
      list: [
        'Disability Certificate',
        'Aadhaar Identity Card',
        'Ration Card',
        'Voter ID Card',
        'Bank Statement'
      ]
    },
    footer: {
      slogan: 'Your Voice, Your Rights',
      closing: 'Together, let us build a barrier-free, inclusive, and compassionate society.',
      contact: '0241 277 7772'
    }
  }
};

export default function LandingPage() {
  const [lang, setLang] = useState<'mr' | 'en'>('mr');
  const [scrolled, setScrolled] = useState(false);
  const t = content[lang];

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-slate-900 overflow-x-hidden selection:bg-blue-500 selection:text-white">
      {/* Premium Ambient Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-100/40 rounded-full blur-[160px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-100/40 rounded-full blur-[140px] animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] mix-blend-overlay"></div>
      </div>

      {/* Navigation */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-500 px-6 ${scrolled ? 'py-4' : 'py-8'}`}>
        <div className={`max-w-7xl mx-auto flex justify-between items-center transition-all duration-500 ${scrolled
          ? 'bg-white/80 backdrop-blur-2xl border border-white/40 rounded-[32px] px-8 py-3 shadow-[0_20px_50px_rgba(0,0,0,0.05)]'
          : 'bg-transparent px-4 py-2'
          }`}>
          <div className="flex items-center gap-4 group cursor-pointer">
            <div className="bg-white p-2 rounded-2xl shadow-lg transition-transform group-hover:scale-110 group-hover:rotate-3">
              <img src={LOGO_URL} alt="DDRC" className="w-8 h-8 object-contain" />
            </div>
            <div>
              <h1 className="text-blue-950 font-black text-2xl tracking-tighter leading-none">DDRC</h1>
              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-[0.3em]">Ahilyanagar</span>
            </div>
          </div>

          <div className="flex items-center gap-4 md:gap-8">
            <button
              onClick={() => setLang(l => l === 'mr' ? 'en' : 'mr')}
              className="text-xs font-black text-blue-900/40 hover:text-blue-600 transition-all uppercase tracking-[0.2em] flex items-center gap-3 group"
            >
              <span className="w-8 h-[1px] bg-blue-200 transition-all group-hover:w-12 group-hover:bg-blue-500"></span>
              {lang === 'mr' ? 'English' : 'मराठी'}
            </button>
            <Link href="/login" className="hidden sm:block px-8 py-3.5 rounded-2xl bg-slate-950 text-white text-[11px] font-black uppercase tracking-[0.2em] hover:bg-blue-900 transition-all shadow-[0_15px_30px_rgba(0,0,0,0.15)] active:scale-95 border border-white/10">
              {lang === 'mr' ? 'लॉगिन' : 'Staff Login'}
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-56 pb-24 px-6 flex flex-col items-center justify-center text-center">
        <div className="relative z-10 max-w-5xl">
          <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-blue-50/50 backdrop-blur-md border border-blue-100 text-blue-700 text-[10px] font-black uppercase tracking-[0.4em] mb-12 mx-auto shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
            </span>
            Official Survey 2026
          </div>

          <h2 className="text-6xl md:text-9xl font-black text-slate-950 mb-10 leading-[0.85] tracking-tightest filter drop-shadow-sm animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
            {t.hero.title}
          </h2>

          <p className="text-xl md:text-2xl text-slate-600 font-semibold max-w-3xl mx-auto mb-16 leading-relaxed opacity-70 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-400">
            {t.hero.subtitle}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 animate-in fade-in slide-in-from-bottom-16 duration-1000 delay-500">
            <Link href="/public/survey" className="group relative px-12 py-6 rounded-[32px] bg-blue-600 text-white text-2xl font-black transition-all hover:bg-blue-700 hover:shadow-[0_25px_50px_rgba(37,99,235,0.3)] hover:-translate-y-2 active:scale-95 overflow-hidden">
              <span className="relative z-10 flex items-center gap-4">
                {t.hero.cta}
                <svg className="w-7 h-7 transition-transform duration-500 group-hover:translate-x-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
            </Link>
          </div>
        </div>

        {/* Abstract Background Elements */}
        <div className="absolute top-1/2 left-0 -translate-y-1/2 -translate-x-1/4 w-[600px] h-[600px] bg-gradient-to-br from-blue-400/10 to-transparent rounded-full blur-[100px] opacity-40"></div>
        <div className="absolute top-1/3 right-0 -translate-y-1/2 translate-x-1/4 w-[700px] h-[700px] bg-gradient-to-bl from-blue-400/10 to-transparent rounded-full blur-[120px] opacity-40"></div>
      </section>

      {/* Structured Content Grid */}
      <section className="max-w-7xl mx-auto px-6 py-32">
        <div className="grid lg:grid-cols-12 gap-10 items-stretch">

          {/* About Section - Large Glass Card */}
          <div className="lg:col-span-12 p-1 md:p-12 rounded-[56px] bg-white border border-slate-100 shadow-[0_30px_70px_rgba(0,0,0,0.03)] group overflow-hidden relative">
            <div className="absolute top-0 right-0 w-[40%] h-full bg-blue-50/50 -skew-x-12 translate-x-1/4 transition-transform duration-1000 group-hover:translate-x-1/3"></div>

            <div className="relative z-10 grid md:grid-cols-2 gap-16 items-center p-8 md:p-0">
              <div>
                <div className="text-blue-600 font-black text-xs uppercase tracking-[0.5em] mb-6">Introduction</div>
                <h3 className="text-4xl md:text-6xl font-black text-slate-950 mb-8 leading-[0.9] tracking-tighter">{t.about.title}</h3>
                <p className="text-xl text-slate-500 font-bold leading-relaxed opacity-80 mb-10">
                  {t.about.description}
                </p>
                <div className="flex gap-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="w-2.5 h-2.5 rounded-full bg-blue-600/20"></div>
                  ))}
                </div>
              </div>
              <div className="relative rounded-[40px] overflow-hidden shadow-2xl">
                <img src={SUPPORT_IMG} alt="Empowerment" className="w-full h-[450px] object-cover transition-transform duration-1000 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 to-transparent"></div>
                <div className="absolute bottom-6 left-6 right-6 p-6 rounded-3xl bg-white/20 backdrop-blur-xl border border-white/30 text-white font-bold text-center italic">
                  "Sutainable Empowerment Through Integration"
                </div>
              </div>
            </div>
          </div>

          {/* Benefits Section */}
          <div className="lg:col-span-7 p-12 rounded-[56px] bg-slate-950 text-white shadow-2xl relative overflow-hidden flex flex-col justify-center">
            <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 blur-[90px] -mr-40 -mt-40"></div>
            <div className="absolute bottom-0 left-0 w-60 h-60 bg-blue-500/10 blur-[80px] -ml-30 -mb-30"></div>

            <h3 className="text-4xl font-black mb-12 relative z-10 tracking-tight">{t.benefits.title}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10">
              {t.benefits.items.map((item, i) => (
                <div key={i} className="group p-5 rounded-[24px] bg-white/5 border border-white/10 transition-all hover:bg-white hover:text-slate-950 cursor-default flex items-start gap-4">
                  <span className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-[10px] font-black group-hover:bg-slate-950 group-hover:text-white">✓</span>
                  <span className="text-sm font-black uppercase tracking-wide leading-tight">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Documents Section */}
          <div className="lg:col-span-5 p-12 rounded-[56px] bg-blue-50 border border-blue-100 flex flex-col justify-center shadow-lg relative overflow-hidden">
            <div className="absolute top-6 right-8 opacity-10 rotate-12 scale-150">
              <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm1 7V3.5L18.5 9H15z" /></svg>
            </div>

            <div className="flex justify-between items-center mb-10 relative z-10">
              <h3 className="text-3xl font-black text-blue-950 tracking-tight">{t.documents.title}</h3>
              <span className="bg-blue-600 text-white px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] shadow-lg">Verify</span>
            </div>

            <div className="space-y-3 relative z-10">
              {t.documents.list.map((doc, i) => (
                <div key={i} className="group flex items-center justify-between p-4 rounded-2xl bg-white/60 backdrop-blur-md border border-blue-200/50 shadow-sm transition-all hover:bg-white hover:-translate-x-2">
                  <span className="font-bold text-blue-950 text-sm">{doc}</span>
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100">
                    <span className="text-blue-600 text-xs">📎</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Progress/Workflow Visualized */}
      <section className="py-40 px-6 relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-24">
            <h3 className="text-5xl md:text-7xl font-black text-slate-950 tracking-tightest mb-6">{t.process.title}</h3>
            <div className="w-24 h-2.5 bg-blue-600 mx-auto rounded-full shadow-lg"></div>
          </div>

          <div className="grid md:grid-cols-3 gap-10">
            {t.process.steps.map((step, i) => (
              <div key={i} className="relative group p-1 md:p-2">
                <div className="relative p-12 rounded-[48px] bg-white border border-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.02)] transition-all duration-700 hover:shadow-[0_40px_100px_rgba(37,99,235,0.1)] hover:-translate-y-4">
                  <div className="text-[120px] font-black text-blue-50 absolute -top-10 -right-4 opacity-50 transition-all duration-700 group-hover:text-blue-100 group-hover:-translate-y-4">0{i + 1}</div>

                  <div className="relative z-10">
                    <div className="w-24 h-24 rounded-[32px] bg-blue-50 flex items-center justify-center text-5xl mb-10 shadow-inner group-hover:bg-blue-600 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
                      {step.icon}
                    </div>
                    <h4 className="text-3xl font-black text-slate-900 mb-6 tracking-tight">{step.title}</h4>
                    <p className="text-slate-500 font-bold text-lg leading-relaxed opacity-70 group-hover:opacity-100 transition-opacity">
                      {step.desc}
                    </p>
                  </div>
                </div>
                {i < 2 && (
                  <div className="hidden lg:block absolute top-1/2 -right-6 -translate-y-1/2 z-20 opacity-20 group-hover:opacity-100 transition-opacity group-hover:translate-x-2 duration-700">
                    <svg className="w-12 h-12 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer / High Impact CTA */}
      <footer className="pt-24 pb-12 px-6 bg-[#F8FAFC]">
        <div className="max-w-7xl mx-auto">
          <div className="bg-slate-950 rounded-[70px] p-16 md:p-32 text-center overflow-hidden relative mb-24 shadow-3xl">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] opacity-20"></div>
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-500/20 via-transparent to-blue-500/10"></div>

            <div className="relative z-10">
              <h4 className="text-4xl md:text-7xl font-black text-white mb-12 leading-[0.9] tracking-tightest">
                {t.footer.slogan}
              </h4>
              <p className="text-blue-400 font-black mb-16 uppercase tracking-[0.6em] text-xs md:text-sm">
                Join Ahilyanagar's Digital Transformation
              </p>

              <Link href="/public/survey" className="group inline-flex items-center gap-6 px-16 py-8 rounded-[40px] bg-white text-slate-950 text-2xl md:text-3xl font-black hover:bg-blue-50 hover:scale-105 transition-all duration-500 shadow-[0_30px_100px_rgba(255,255,255,0.15)] active:scale-95">
                {t.hero.cta}
                <div className="w-12 h-12 rounded-full bg-slate-950 text-white flex items-center justify-center transition-transform group-hover:rotate-45">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M7 17L17 7M17 7H7M17 7V17" /></svg>
                </div>
              </Link>

              <p className="mt-16 text-slate-500 font-bold text-sm max-w-xl mx-auto leading-relaxed opacity-60">
                {t.footer.closing}
              </p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-center gap-12 border-t border-slate-200 pt-16">
            <div className="flex items-center gap-5 transition-opacity hover:opacity-100 opacity-60">
              <div className="bg-slate-950 p-2 rounded-xl">
                <img src={LOGO_URL} alt="Logo" className="w-6 h-6 object-contain invert" />
              </div>
              <span className="text-[12px] font-black uppercase tracking-[0.4em] text-slate-900">DDRC AHILYANAGAR</span>
            </div>

            <div className="flex flex-wrap justify-center gap-16 text-[11px] font-black uppercase tracking-[0.3em] text-slate-400">
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                HELPLINE: <span className="text-slate-900">{t.footer.contact}</span>
              </div>
              <p>© 2026 OFFICIAL SURVEY PORTAL</p>
            </div>
          </div>
        </div>
      </footer>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@100..900&display=swap');
        
        :root {
          --font-outfit: 'Outfit', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }

        body {
          font-family: var(--font-outfit);
          scroll-behavior: smooth;
        }

        .tracking-tightest {
          letter-spacing: -0.05em;
        }

        ::selection {
          background: #2563eb;
          color: white;
        }

        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
          100% { transform: translateY(0px); }
        }

        .animate-float {
          animation: float 5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
