'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const LOGO_URL = '/ddrc app icon (192 x 192 px) (1024 x 1024 px)(1).png';
const HERO_BG = '/campaign_hero_bg_1769749378735.png';
const SUPPORT_IMG = '/empowerment_support_1769749398366.png';

const content = {
  mr: {
    hero: {
      title: 'दिव्यांग सर्वेक्षण अभियान – २०२६',
      subtitle: 'जिल्हा प्रशासन, अहिल्यानगर व जिल्हा दिव्यांग पुनर्वसन केंद्र यांचा संयुक्त उपक्रम',
      cta: 'सर्वेक्षण सुरू करा',
    },
    about: {
      title: 'अभियानाबद्दल',
      description: 'अहिल्यानगर जिल्ह्यातील सर्व दिव्यांग बांधवांचे अचूक, अद्ययावत व विश्वासार्ह माहिती संकलित करण्यासाठी हे विशेष सर्वेक्षण राबविण्यात येत आहे. या माहितीच्या आधारे दिव्यांग बांधवांना विविध शासकीय योजना व सेवा प्रभावीपणे उपलब्ध करून देण्यात येणार आहेत.',
    },
    process: {
      title: 'सर्वेक्षण प्रक्रिया',
      steps: [
        {
          title: 'प्रशिक्षित कर्मचारी',
          desc: 'सर्वेक्षण आशा सेविका, अंगणवाडी सेविका व प्रशिक्षित स्वयंसेवकांमार्फत घरोघरी जाऊन करण्यात येईल.',
          icon: '🏠'
        },
        {
          title: 'डिजिटल नोंदणी',
          desc: 'यासाठी स्वतंत्र मोबाईल अॅप व अधिकृत वेबसाइट विकसित करण्यात आली आहे.',
          icon: '📱'
        },
        {
          title: 'संपर्क व पडताळणी',
          desc: 'प्राथमिक माहिती भरल्यानंतर संबंधित व्यक्तीशी गावपातळीवर संपर्क साधून माहितीची नोंद पूर्ण केली जाईल.',
          icon: '✅'
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
      cta: 'Start Survey',
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
          icon: '🏠'
        },
        {
          title: 'Digital Ecosystem',
          desc: 'Advanced mobile applications and web portals designed for seamless data integrity.',
          icon: '📱'
        },
        {
          title: 'Validation',
          desc: 'Rigorous multi-level verification ensures every record is authentic and verified.',
          icon: '✅'
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
  const t = content[lang];

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-slate-900 overflow-x-hidden selection:bg-teal-500 selection:text-white">
      {/* Dynamic Background Elements */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-teal-100/30 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-5%] right-[-5%] w-[35%] h-[35%] bg-blue-100/30 rounded-full blur-[100px]"></div>
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 px-6 py-5">
        <div className="max-w-7xl mx-auto flex justify-between items-center transition-all bg-white/40 backdrop-blur-xl border border-white/40 rounded-3xl px-6 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.05)]">
          <div className="flex items-center gap-4">
            <div className="bg-teal-600 p-2 rounded-xl shadow-lg">
              <img src={LOGO_URL} alt="DDRC" className="w-8 h-8 object-contain brightness-0 invert" />
            </div>
            <div>
              <h1 className="text-teal-950 font-black text-xl tracking-tight leading-none">DDRC</h1>
              <span className="text-[10px] font-bold text-teal-600 uppercase tracking-[0.2em]">Ahilyanagar</span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <button
              onClick={() => setLang(l => l === 'mr' ? 'en' : 'mr')}
              className="text-sm font-bold text-teal-900/60 hover:text-teal-600 transition-colors uppercase tracking-widest flex items-center gap-2"
            >
              <span className="w-5 h-[1px] bg-teal-200"></span>
              {lang === 'mr' ? 'English' : 'मराठी'}
            </button>
            <Link href="/login" className="px-6 py-2.5 rounded-2xl bg-slate-950 text-white text-sm font-bold hover:bg-teal-900 transition-all shadow-xl active:scale-95">
              {lang === 'mr' ? 'लॉगिन' : 'Staff Login'}
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-44 pb-32 px-6 flex flex-col items-center justify-center text-center">
        <div className="relative z-10 max-w-4xl">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-50 border border-teal-100 text-teal-700 text-[10px] font-black uppercase tracking-[0.3em] mb-10 mx-auto shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
            </span>
            Campaign 2026
          </div>

          <h2 className="text-5xl md:text-8xl font-black text-slate-950 mb-8 leading-[0.95] tracking-tighter">
            {t.hero.title}
          </h2>

          <p className="text-xl md:text-2xl text-slate-600 font-medium max-w-2xl mx-auto mb-14 leading-relaxed opacity-80">
            {t.hero.subtitle}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
            <Link href="/public/survey" className="group relative px-10 py-5 rounded-3xl bg-teal-600 text-white text-xl font-bold transition-all hover:bg-teal-700 hover:shadow-[0_20px_40px_rgba(13,148,136,0.3)] hover:-translate-y-1 active:scale-95 overflow-hidden">
              <span className="relative z-10 flex items-center gap-3">
                {t.hero.cta}
                <svg className="w-6 h-6 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-teal-400/0 via-white/20 to-teal-400/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
            </Link>
          </div>
        </div>

        {/* Floating Abstract Shapes */}
        <div className="absolute top-1/2 left-0 -translate-y-1/2 -translate-x-1/2 w-96 h-96 bg-gradient-to-br from-teal-400/10 to-transparent rounded-full blur-3xl opacity-50"></div>
        <div className="absolute top-1/3 right-0 -translate-y-1/2 translate-x-1/2 w-[500px] h-[500px] bg-gradient-to-bl from-blue-400/10 to-transparent rounded-full blur-[100px] opacity-30"></div>
      </section>

      {/* Grid Content */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-stretch">

          {/* About Glass Card */}
          <div className="p-10 rounded-[40px] bg-white border border-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.02)] flex flex-col justify-between">
            <div>
              <div className="text-teal-600 font-black text-xs uppercase tracking-widest mb-4">MISSION</div>
              <h3 className="text-4xl font-black text-slate-900 mb-8 leading-tight">{t.about.title}</h3>
              <p className="text-xl text-slate-500 font-medium leading-relaxed opacity-90">
                {t.about.description}
              </p>
            </div>
            <div className="mt-12 relative rounded-[30px] overflow-hidden group">
              <img src={SUPPORT_IMG} alt="Impact" className="w-full h-80 object-cover grayscale-[0.2] transition-all duration-700 group-hover:scale-110 group-hover:rotate-1" />
              <div className="absolute inset-0 bg-teal-900/10 group-hover:bg-teal-900/0 transition-colors"></div>
            </div>
          </div>

          <div className="grid gap-8">
            {/* Benefits List */}
            <div className="p-10 rounded-[40px] bg-slate-950 text-white shadow-2xl overflow-hidden relative group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/20 blur-[80px] -mr-32 -mt-32"></div>
              <h3 className="text-3xl font-black mb-8 relative z-10">{t.benefits.title}</h3>
              <div className="flex flex-wrap gap-4 relative z-10">
                {t.benefits.items.map((item, i) => (
                  <div key={i} className="px-5 py-3 rounded-2xl bg-white/5 border border-white/10 text-sm font-bold flex items-center gap-3 hover:bg-white hover:text-slate-950 transition-all cursor-default">
                    <span className="text-teal-400">●</span> {item}
                  </div>
                ))}
              </div>
            </div>

            {/* Documents List */}
            <div className="p-10 rounded-[40px] bg-teal-50 border border-teal-100">
              <div className="flex justify-between items-start mb-8">
                <h3 className="text-3xl font-black text-teal-900">{t.documents.title}</h3>
                <span className="bg-teal-200/50 text-teal-800 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">Required</span>
              </div>
              <div className="grid gap-3">
                {t.documents.list.map((doc, i) => (
                  <div key={i} className="group flex items-center justify-between p-4 rounded-2xl bg-white/50 border border-teal-200/50 shadow-sm transition-all hover:bg-white hover:-translate-x-1">
                    <span className="font-bold text-teal-950">{doc}</span>
                    <span className="opacity-20 group-hover:opacity-100 transition-opacity">📎</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Progress/Workflow */}
      <section className="py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h3 className="text-4xl md:text-6xl font-black text-slate-950 tracking-tighter mb-4">{t.process.title}</h3>
            <div className="w-24 h-2 bg-teal-600 mx-auto rounded-full"></div>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {t.process.steps.map((step, i) => (
              <div key={i} className="relative p-10 rounded-[40px] bg-white border border-slate-100 group transition-all hover:border-teal-200">
                <div className="text-8xl font-black text-teal-50 absolute top-4 right-8 opacity-50 group-hover:text-teal-100 transition-colors">0{i + 1}</div>
                <div className="relative z-10">
                  <div className="w-20 h-20 rounded-3xl bg-teal-50 flex items-center justify-center text-4xl mb-8 shadow-inner group-hover:bg-teal-600 group-hover:scale-110 transition-all">
                    {step.icon}
                  </div>
                  <h4 className="text-2xl font-black text-slate-900 mb-4 tracking-tight">{step.title}</h4>
                  <p className="text-slate-500 font-medium leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer / Final Action */}
      <footer className="pt-20 pb-10 px-6 bg-slate-50 border-t border-slate-100 mt-20">
        <div className="max-w-7xl mx-auto">
          <div className="bg-slate-950 rounded-[50px] p-12 md:p-24 text-center overflow-hidden relative mb-20">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] opacity-30"></div>
            <div className="absolute top-0 left-0 w-1/2 h-full bg-teal-600/10 blur-[120px]"></div>

            <div className="relative z-10">
              <h4 className="text-3xl md:text-5xl font-black text-white mb-8 tracking-tighter">
                {t.footer.slogan}
              </h4>
              <p className="text-teal-400/80 font-bold mb-12 uppercase tracking-[0.4em] text-sm">
                Join the Movement
              </p>
              <Link href="/public/survey" className="inline-flex items-center gap-4 px-12 py-6 rounded-[32px] bg-white text-slate-950 text-2xl font-black hover:bg-teal-50 hover:scale-[1.03] transition-all shadow-2xl active:scale-95">
                {t.hero.cta}
              </Link>
              <p className="mt-12 text-slate-500 text-sm max-w-lg mx-auto leading-relaxed">
                {t.footer.closing}
              </p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-center gap-10 border-t border-slate-200 pt-10">
            <div className="flex items-center gap-3 opacity-50">
              <img src={LOGO_URL} alt="Logo" className="w-6 h-6 object-contain" />
              <span className="text-xs font-black uppercase tracking-widest text-slate-900 italic">DDRC AHILYANAGAR</span>
            </div>
            <div className="flex items-center gap-12 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              <p>HELPLINE: {t.footer.contact}</p>
              <p>© 2026 OFFICIAL SURVEY PORTAL</p>
            </div>
          </div>
        </div>
      </footer>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@100..900&display=swap');
        
        body {
          font-family: 'Outfit', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          -webkit-font-smoothing: antialiased;
        }

        ::selection {
          background: #0d9488;
          color: white;
        }

        .min-h-screen {
          scroll-behavior: smooth;
        }
      `}</style>
    </div>
  );
}
