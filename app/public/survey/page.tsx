'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { apiCall, getQuestions, submitAnswers, uploadImage } from '@/lib/api-client';
import { getAbsoluteImageUrl } from '@/lib/config';

interface Question {
  id: number | string;
  section_id?: number;
  title?: string;
  question: string;
  question_type: string;
  multi_select?: number | string;
  options?: string | null;
  rendering_condition?: string;
  rendering_question?: string | null;
  rendering_value?: string | null;
  regex?: string;
  valid_input?: string;
  max_length?: number;
  status?: string;
  error?: string;
}

interface QuestionSection {
  title: string;
  questions: Question[];
}

type Step = 'upload-front' | 'upload-back' | 'aadhar-info' | 'personal-info' | 'complete';

const LOGO_URL = '/ddrc app icon (192 x 192 px) (1024 x 1024 px)(1).png';
const getQuestionIdNumber = (id: number | string): number => typeof id === 'string' ? parseInt(id, 10) : id;

export default function PublicFormPage() {
  const [lang, setLang] = useState<'mr' | 'en'>('mr');
  const [currentStep, setCurrentStep] = useState<Step>('upload-front');
  const [frontImage, setFrontImage] = useState<File | null>(null);
  const [backImage, setBackImage] = useState<File | null>(null);
  const [frontImageUrl, setFrontImageUrl] = useState<string>('');
  const [backImageUrl, setBackImageUrl] = useState<string>('');
  const [aadharNo, setAadharNo] = useState('');
  const [divyangName, setDivyangName] = useState('');
  const [aadharId, setAadharId] = useState<number | null>(null);
  const [existingSurveyData, setExistingSurveyData] = useState<any>(null);
  const [checkingExisting, setCheckingExisting] = useState(false);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const questionSections = useMemo(() => {
    const normalized = allQuestions.map(q => ({ ...q, id: typeof q.id === 'string' ? parseInt(q.id, 10) : q.id }));
    const sectionsMap = new Map<string, Question[]>();
    normalized.forEach(q => {
      const title = q.title || 'Other';
      if (!sectionsMap.has(title)) sectionsMap.set(title, []);
      sectionsMap.get(title)!.push(q);
    });
    const sections = Array.from(sectionsMap.entries()).map(([title, qs]) => ({ title, questions: qs }));
    sections.sort((a, b) => getQuestionIdNumber(a.questions[0].id) - getQuestionIdNumber(b.questions[0].id));
    return sections;
  }, [allQuestions]);
  const [answers, setAnswers] = useState<Record<number | string, any>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Address lookup states
  const [talukas, setTalukas] = useState<string[]>([]);
  const [villages, setVillages] = useState<string[]>([]);
  const [grams, setGrams] = useState<string[]>([]);
  const [talathi, setTalathi] = useState<string[]>([]);
  const [phc, setPhc] = useState<string[]>([]);
  const [disabilityTypes, setDisabilityTypes] = useState<string[]>([]);
  const [loadingDisabilityTypes, setLoadingDisabilityTypes] = useState(false);

  // Caste Data States
  const [casteCategories, setCasteCategories] = useState<any[]>([]);
  const [availableCastes, setAvailableCastes] = useState<any[]>([]);
  const [loadingCastes, setLoadingCastes] = useState(false);

  // Import Next.js Image component




  const stepsOrder: Step[] = ['upload-front', 'upload-back', 'aadhar-info', 'personal-info'];
  const currentStepIndex = stepsOrder.indexOf(currentStep);

  useEffect(() => {
    loadQuestions();
    loadTalukas();
    loadCasteData();
  }, []);

  useEffect(() => {
    if (allQuestions.length > 0) loadDisabilityTypes();
  }, [allQuestions.length]);

  const loadCasteData = async () => {
    try {
      const resp = await fetch('/api/get-castes');
      const data = await resp.json();
      if (Array.isArray(data)) {
        setCasteCategories(data);
      }
    } catch (e) {
      console.error("Failed to load caste data", e);
    }
  };

  // Prefill name, aadhaar, and district when entering personal-info step
  useEffect(() => {
    if (currentStep === 'personal-info' && allQuestions.length > 0) {
      setAnswers(prev => {
        const updates: Record<number | string, any> = { ...prev };

        // Prefill name
        const nameQuestion = allQuestions.find(q =>
          (q.question?.includes('दिव्यांगांचे') && q.question?.includes('नाव')) ||
          (q.question?.includes('नाव') && q.title === 'वैयक्तिक माहिती') ||
          (q.id.toString() === '1')
        );
        if (nameQuestion && divyangName && !updates[nameQuestion.id]) {
          updates[nameQuestion.id] = divyangName;
        }

        // Prefill aadhaar
        const aadhaarQuestion = allQuestions.find(q => {
          const t = (q.question || '').toLowerCase();
          return t.includes('आधार') &&
            (t.includes('क्रमांक') || t.includes('नंबर') || t.includes('no') || t.includes('number')) &&
            !t.includes('फोटो') && !t.includes('photo') && !t.includes('image');
        });
        if (aadhaarQuestion && aadharNo && !updates[aadhaarQuestion.id]) {
          updates[aadhaarQuestion.id] = aadharNo;
        }

        // Prefill district as अहिल्यानगर
        const districtQuestion = allQuestions.find(q => q.question?.includes('जि.') || q.question?.includes('जिल्हा'));
        if (districtQuestion && !updates[districtQuestion.id]) {
          updates[districtQuestion.id] = 'अहिल्यानगर';
        }

        return updates;
      });
    }
  }, [currentStep, allQuestions, divyangName, aadharNo]);


  // Effect to update available castes when category changes
  useEffect(() => {
    // Find the question for Caste Category
    const categoryQuestion = allQuestions.find(q =>
      (q.question || '').includes('जातीचा प्रवर्ग') ||
      (q.question || '').toLowerCase().includes('caste category')
    );

    if (categoryQuestion) {
      const selectedCategoryName = answers[categoryQuestion.id];
      if (selectedCategoryName) {
        const category = casteCategories.find(c =>
          c.nameMarathi === selectedCategoryName ||
          c.nameEnglish === selectedCategoryName ||
          // Handle cases where answer might be formatted differently e.g. "Open (Example)"
          (c.nameMarathi && selectedCategoryName.includes(c.nameMarathi))
        );

        if (category && category.castes) {
          setAvailableCastes(category.castes);
        } else {
          setAvailableCastes([]);
        }
      } else {
        setAvailableCastes([]);
      }
    }
  }, [answers, allQuestions, casteCategories]);

  const loadQuestions = async () => {
    setLoading(true);
    console.log('Starting loadQuestions...');
    try {
      // Direct fetch to debug
      const res = await fetch('/api/get-questions?public=true');
      const data = await res.json();
      console.log('Questions API Response:', data);

      if (data.ok && Array.isArray(data.data)) {
        const questions = data.data as Question[];
        console.log('Questions loaded:', questions.length);
        const normalized = questions.map(q => ({
          ...q,
          id: typeof q.id === 'string' ? parseInt(q.id, 10) : q.id
        }));
        setAllQuestions(normalized);
      } else {
        console.error('Invalid questions structure:', data);
        setError('Failed to load questions: ' + (data.error || 'Invalid Format'));
      }
    } catch (err: any) {
      console.error('Questions fetch error:', err);
      setError('Questions error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadTalukas = async () => {
    try {
      const resp = await fetch('/api/get-talukas');
      const data = await resp.json();
      if (data.ok) setTalukas(data.talukas);
    } catch { }
  };

  const loadDisabilityTypes = async () => {
    if (loadingDisabilityTypes || disabilityTypes.length > 0) return;
    setLoadingDisabilityTypes(true);
    try {
      const resp = await fetch('/api/get-questions');
      const data = await resp.json();
      if (data.ok && data.data) {
        const q = data.data.find((x: any) => x.id == 69 || x.question?.includes('दिव्यांगता प्रकार'));
        if (q?.options) setDisabilityTypes(q.options.split(',').map((o: any) => o.trim()).filter(Boolean));
      }
    } catch { } finally { setLoadingDisabilityTypes(false); }
  };

  const loadDependentData = async (taluka: string) => {
    if (!taluka) return;
    try {
      const [v, g, t, p] = await Promise.all([
        fetch(`/api/get-villages?taluka=${encodeURIComponent(taluka)}`),
        fetch(`/api/get-grams?taluka=${encodeURIComponent(taluka)}`),
        fetch(`/api/get-talathi?taluka=${encodeURIComponent(taluka)}`),
        fetch(`/api/get-phc?taluka=${encodeURIComponent(taluka)}`),
      ]);
      const vd = await v.json(); if (vd.ok) setVillages(vd.villages);
      const gd = await g.json(); if (gd.ok) setGrams(gd.grams);
      const td = await t.json(); if (td.ok) setTalathi(td.talathi);
      const pd = await p.json(); if (pd.ok) setPhc(pd.phc);
    } catch { }
  };

  const handleFrontImageUpload = (e: any) => {
    const file = e.target.files?.[0];
    if (file) { setFrontImage(file); setFrontImageUrl(URL.createObjectURL(file)); }
  };

  const handleBackImageUpload = (e: any) => {
    const file = e.target.files?.[0];
    if (file) { setBackImage(file); setBackImageUrl(URL.createObjectURL(file)); }
  };

  const checkExistingSurvey = async (aadhar: string) => {
    if (aadhar.replace(/\D/g, '').length !== 12) return;
    setCheckingExisting(true);
    try {
      const resp = await apiCall('public/get-survey-by-aadhar', {
        method: 'POST',
        body: JSON.stringify({ aadhar_no: aadhar.replace(/\D/g, '') }),
      });
      if (resp.ok && resp.exists) setExistingSurveyData(resp.data);
    } catch { } finally { setCheckingExisting(false); }
  };

  const createAadharRecord = async () => {
    setLoading(true); setError('');
    try {
      if (existingSurveyData?.aadhar_id) {
        setAadharId(existingSurveyData.aadhar_id);
        if (existingSurveyData.answers) setAnswers(prev => ({ ...prev, ...existingSurveyData.answers }));
        setCurrentStep('personal-info');
        return;
      }
      if (!frontImage || !backImage || !aadharNo || !divyangName) {
        throw new Error('कृपया सर्व माहिती भरा आणि आधार फोटो अपलोड करा');
      }
      const fd = new FormData();
      fd.append('front_image', frontImage);
      fd.append('back_image', backImage);
      fd.append('aadhar_no', aadharNo.replace(/\D/g, ''));
      fd.append('divyang_name', divyangName);
      const up = await fetch('/api/public/upload-aadhar', { method: 'POST', body: fd });
      const ud = await up.json();
      if (!ud.ok) throw new Error(ud.error);
      const cr = await apiCall('public/create-aadhar', {
        method: 'POST',
        body: JSON.stringify({ aadhar_no: aadharNo.replace(/\D/g, ''), divyang_name: divyangName, front_image: ud.front_image, back_image: ud.back_image }),
      });
      if (!cr.ok) throw new Error(cr.error);
      setAadharId(cr.aadhar_id);
      setCurrentStep('personal-info');
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const submitForm = async () => {
    setSubmitting(true); setError('');

    // Final Validation Check
    const visible: Question[] = [];
    let hasValidationError = false;

    const updatedQuestions = allQuestions.map(q => {
      const label = (q.question || '').trim();
      const lowerLabel = label.toLowerCase();
      const title = (q.title || '').toLowerCase();

      // Robust detection of hidden fields
      const isAadhaarPhoto = lowerLabel.includes('आधार') && (lowerLabel.includes('फोटो') || lowerLabel.includes('photo') || lowerLabel.includes('image') || lowerLabel.includes('पुढील') || lowerLabel.includes('मागील'));
      const isAadhaarNumber = lowerLabel.includes('आधार') && (lowerLabel.includes('नंबर') || lowerLabel.includes('क्रमांक') || lowerLabel.includes('no') || lowerLabel.includes('number'));
      const isIdSection = title.includes('ओळखपत्र') || title.includes('documents') || title.includes('identity');

      // Also check specific exact matches just in case
      const isExactAadhaar = label === 'आधार कार्ड नंबर' || label === 'आधार क्रमांक';

      const isHidden = isAadhaarPhoto || isAadhaarNumber || isExactAadhaar || isIdSection;

      if (shouldShowQuestion(q) && !isHidden) {
        visible.push(q);
        const val = answers[q.id] || '';
        const validationError = validateInput(q, String(val));
        if (validationError) {
          hasValidationError = true;
          return { ...q, error: validationError };
        }
      }
      return { ...q, error: undefined }; // Clear previous errors
    });

    if (hasValidationError) {
      setAllQuestions(updatedQuestions);
      const errorFields = updatedQuestions.filter(q => q.error).map(q => q.question).join(', ');
      setError(`कृपया लाल रंगातील त्रुटी तपासा (Please fix errors in): ${errorFields}`);
      setSubmitting(false);

      // Give React a moment to render the error states before scrolling
      setTimeout(() => {
        const firstError = document.querySelector('.border-red-500');
        if (firstError) {
          firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 200);
      return;
    }

    try {
      const res = await submitAnswers(1, aadharId!, visible.map(q => ({
        question_id: q.id,
        section_id: q.section_id || null,
        answer: Array.isArray(answers[q.id]) ? answers[q.id].join(',') : String(answers[q.id] || '--'),
      })), 'Divyang Self');

      if (res.ok) setCurrentStep('complete');
      else throw new Error(res.error);
    } catch (err: any) { setError(err.message); }
    finally { setSubmitting(false); }
  };

  const shouldShowQuestion = (q: Question): boolean => {
    // Specific fix for "Willing to marry" showing when "Married"
    // This must be checked BEFORE standard conditional logic to override defaults
    const qText = (q.question || '').trim();
    if (qText.includes('विवाह') && qText.includes('मानस')) {
      // Search ALL questions for marital status to handle duplicates/ordering issues
      const maritalQuestions = allQuestions.filter(x => {
        const xText = (x.question || '').trim();
        return xText.includes('वैवाहिक') || xText.toLowerCase().includes('marital');
      });

      // Get actual selected answers (filtering out empty/default/placeholder values)
      const maritalAnswers = maritalQuestions
        .map(mq => String(answers[mq.id] || '').trim())
        .filter(a => {
          // Must have value
          if (!a) return false;
          // Must not be a placeholder
          const lower = a.toLowerCase();
          if (lower.includes('select')) return false;
          if (lower.includes('निवडा')) return false;
          if (a === '--') return false;
          return true;
        });

      // 1. If NO valid answer selected yet -> HIDE (Wait for user input)
      if (maritalAnswers.length === 0) return false;

      // 2. Logic Check:
      // If Answer is "विवाहित" (Married) -> HIDE "Willing to marry?"
      // If Answer is anything else (Unmarried, Widow, Widower, Divorced) -> SHOW "Willing to marry?"

      const isMarried = maritalAnswers.some(ans =>
        ans.trim() === 'विवाहित' || ans.toLowerCase() === 'married'
      );

      // If Married, DO NOT show "Willing to marry"
      if (isMarried) return false;

      // If NOT Married (Unmarried, Widow, etc.), SHOW "Willing to marry"
      return true;
    }

    // REMOVED: Old Address Hiding Logic
    // We now handle strict filtering in the render loop itself.
    // shouldShowQuestion is now PURELY for conditional logic (rendering_condition).

    const cond = (q.rendering_condition || '').toString().toLowerCase();
    if (!cond || cond === 'no' || cond === 'false' || cond === '0') return true;

    // Use lowercase and trimmed for matching
    const parentLabel = (q.rendering_question || '').toString().trim().toLowerCase();
    const expectedValue = (q.rendering_value || '').toString().trim().toLowerCase();

    if (!parentLabel || !expectedValue) return true;

    // Find parent question by label or ID with flexible match
    const parent = allQuestions.find(x => {
      const qText = (x.question || '').trim().toLowerCase();
      const qId = x.id.toString();
      return qText === parentLabel || qId === parentLabel || qText.includes(parentLabel) || parentLabel.includes(qText);
    });

    if (!parent) return true; // If parent not found, show question

    const parentAnswer = answers[parent.id];
    if (!parentAnswer) return false; // Parent not answered yet

    const ans = String(parentAnswer).trim().toLowerCase();

    // Split expected values by comma or pipe
    const expectedValues = expectedValue.split(/[|,]/).map(v => v.trim().toLowerCase());

    // Check if answer matches any expected value (case-insensitive)
    return expectedValues.some(expected => {
      // Exact match
      if (ans === expected) return true;
      // Contains match (for multi-select or complex values)
      if (ans.includes(expected)) return true;
      // Reverse contains (if expected is longer)
      if (expected.includes(ans)) return true;
      return false;
    });
  };

  const validateInput = (q: Question, val: string) => {
    if (!val || val.trim() === '') {
      if (q.question_type !== 'upload') return 'हे क्षेत्र आवश्यक आहे (Required)';
      return '';
    }

    const label = q.question?.trim() || '';

    // Mobile number validation
    if (label.includes('मोबाईल') || label.includes('Mobile')) {
      if (!/^\d{10}$/.test(val)) return 'मोबाईल नंबर १० अंकी असावा';
    }

    // Pin code validation
    if (label.includes('पिन कोड') || label.toLowerCase().includes('pin')) {
      if (!/^\d{6}$/.test(val)) return 'पिन कोड ६ अंकी असावा';
    }

    // Ration card / Aadhaar validation (strictly 12 digits)
    if (label.includes('ration') || label.includes('राशन') || label.includes('रेशन') || label.includes('रेशान') ||
      (label.includes('आधार') && (label.includes('क्रमांक') || label.includes('नंबर') || label.includes('no') || label.includes('number')))) {
      if (!/^\d{12}$/.test(val)) return '१२ अंक आवश्यक आहेत (12 digits required)';
    }

    // Total members validation (max 2 digits)
    if (label.includes('एकूण सदस्य') || label.includes('Total Members')) {
      if (!/^\d{1,2}$/.test(val) || parseInt(val) < 1) return 'कृपया योग्य संख्या टाका (1-99)';
    }

    if (q.regex) {
      try {
        const re = new RegExp(q.regex);
        if (!re.test(val)) return `Invalid format. Expected: ${q.regex}`;
      } catch (e) { }
    }

    if (q.valid_input === 'numeric') {
      if (!/^\d*$/.test(val)) return 'Only numbers allowed';
    }

    return '';
  };

  const getDisplayUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('blob:') || url.startsWith('data:')) return url;
    return getAbsoluteImageUrl(url);
  };

  const handleAnswerChange = (qid: any, val: any) => {
    setAnswers(prev => {
      const next: Record<number | string, any> = { ...prev, [qid]: val };
      const q = allQuestions.find(x => x.id === qid);

      // Clear error on change if valid
      if (q) {
        const validationError = validateInput(q, String(val));
        setAllQuestions(questions => questions.map(qu => qu.id === qid ? { ...qu, error: validationError } : qu));
      }

      // Auto-calculate age from DOB
      if (q?.question?.includes('जन्म तारीख') || q?.question?.includes('DOB')) {
        const ageQuestion = allQuestions.find(x => x.question?.includes('वय') || x.question?.toLowerCase().includes('age'));
        if (ageQuestion && val) {
          const birthDate = new Date(val);
          const today = new Date();
          let age = today.getFullYear() - birthDate.getFullYear();
          const monthDiff = today.getMonth() - birthDate.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
          }
          next[ageQuestion.id] = age.toString();
        }
      }

      const label = q?.question?.trim() || '';
      const isTaluka = label === 'ता.' || label.includes('ता.') || label.includes('तालुका') || label.toLowerCase().includes('taluka');
      if (isTaluka) loadDependentData(val);
      return next;
    });
  };

  const handleFileUpload = async (qid: any, file: File) => {
    const url = URL.createObjectURL(file);
    handleAnswerChange(qid, url);
    try {
      const up = await uploadImage(file);
      if (up) handleAnswerChange(qid, up);
    } catch { }
  };

  const renderQuestion = (q: Question) => {
    const ans = answers[q.id];
    const label = q.question?.trim() || '';
    const isTaluka = label === 'ता.' || label.includes('तालुका') || label.toLowerCase().includes('taluka');
    const isVillage = label.includes('गाव') || label.toLowerCase().includes('village');
    const isGram = label.includes('ग्रामपंचायत') || label.toLowerCase().includes('gram');
    const isTalathi = label.includes('तलाठी') || label.toLowerCase().includes('talathi');
    const isPhc = label.includes('आरोग्य केंद्र') || label.includes('PHC') || label.toLowerCase().includes('phc');
    const isType = label.includes('दिव्यांगता प्रकार');
    const isCasteCategory = label.includes('जातीचा प्रवर्ग') || label.toLowerCase().includes('caste category');
    const isCaste = label.includes('पोट जात') || label.toLowerCase().includes('sub caste') || label.trim() === 'जात';

    let options: string[] = [];
    if (isTaluka) options = talukas;
    else if (isVillage) options = villages;
    else if (isGram) options = grams;
    else if (isTalathi) options = talathi;
    else if (isPhc) options = phc;
    else if (isType) options = disabilityTypes;
    else if (isCasteCategory) options = casteCategories.map(c => `${c.nameMarathi} (${c.code})`);
    else if (isCaste) options = availableCastes.map(c => c.nameMarathi);
    else if (q.options && q.options !== 'NULL') options = q.options.split(',').map(o => o.trim());

    const isDynamicMCQ = isTaluka || isVillage || isGram || isTalathi || isPhc || isType || isCasteCategory || isCaste;

    const hasError = !!q.error;
    const baseInputClasses = "w-full bg-white/50 backdrop-blur-sm border rounded-2xl px-5 py-4 text-slate-900 font-bold outline-none transition-all duration-300 shadow-sm";
    const inputClasses = `${baseInputClasses} ${hasError ? 'border-red-500 focus:ring-4 focus:ring-red-500/10 bg-red-50/50' : 'border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white'}`;

    return (
      <div key={q.id} id={`q-${q.id}`} className={`group bg-white/40 p-6 md:p-8 rounded-[32px] border-2 ${hasError ? 'border-red-500 shadow-[0_0_0_4px_rgba(239,68,68,0.1)]' : 'border-white/60'} shadow-sm hover:shadow-md transition-all duration-500 hover:bg-white/60`}>
        <div className="flex justify-between items-start mb-4">
          <label className={`block text-[11px] font-black uppercase tracking-[0.2em] transition-colors ${hasError ? 'text-red-600' : 'text-slate-400 group-hover:text-blue-600'}`}>{q.question}</label>
          {hasError && <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider animate-in fade-in slide-in-from-right-2 bg-red-100 px-2 py-1 rounded">{q.error}</span>}
        </div>

        {isDynamicMCQ || q.question_type.toLowerCase() === 'mcq' ? (
          <select className={inputClasses} value={ans || ''} onChange={(e) => handleAnswerChange(q.id, e.target.value)}>
            <option value="">-- निवडा --</option>
            {options.map((o, i) => <option key={i} value={o}>{o}</option>)}
          </select>
        ) : q.question_type.toLowerCase() === 'upload' ? (
          <div className="space-y-4">
            <div className="relative group/up">
              <input type="file" className="hidden" id={`up-${q.id}`} accept="image/*" onChange={(e) => e.target.files?.[0] && handleFileUpload(q.id, e.target.files[0])} />
              <label htmlFor={`up-${q.id}`} className={`w-full bg-slate-100/50 border-2 border-dashed ${hasError ? 'border-red-300 bg-red-50/30' : 'border-slate-300'} rounded-2xl h-24 flex items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-white transition-all`}>
                {ans ? (
                  <div className="relative w-full h-full p-2">
                    <Image
                      src={getDisplayUrl(ans)}
                      alt="Upload"
                      fill
                      className="object-contain"
                      unoptimized={true}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1 opacity-40 group-hover/up:opacity-100 transition-opacity">
                    <span className="text-2xl">📸</span>
                    <span className="text-[10px] font-black uppercase tracking-widest">Upload Photo</span>
                  </div>
                )}
              </label>
            </div>
          </div>
        ) : q.question_type.toLowerCase() === 'date' ? (
          <input type="date" className={inputClasses} value={ans || ''} onChange={(e) => handleAnswerChange(q.id, e.target.value)} />
        ) : (
          <input
            type={q.valid_input === 'numeric' || label.includes('मोबाईल') || label.includes('Mobile') ? 'tel' : label.includes('ईमेल') || label.includes('Email') || label.includes('email') ? 'email' : 'text'}
            className={inputClasses}
            placeholder="..."
            value={ans || ''}
            inputMode={q.valid_input === 'numeric' || label.includes('मोबाईल') || label.includes('Mobile') ? 'numeric' : undefined}
            pattern={label.includes('मोबाईल') || label.includes('Mobile') ? '[0-9]{10}' : undefined}
            onChange={(e) => {
              let value = e.target.value;
              // Mobile number: only digits, max 10
              if (label.includes('मोबाईल') || label.includes('Mobile')) {
                value = value.replace(/\D/g, '').slice(0, 10);
              }
              // Ration card / Aadhaar: only digits, max 12
              const isRationOrAadhar = (label.includes('ration') || label.includes('राशन') || label.includes('रेशन') || label.includes('रेशान') ||
                (label.includes('आधार') && (label.includes('क्रमांक') || label.includes('नंबर') || label.includes('no') || label.includes('number'))));
              if (isRationOrAadhar) {
                value = value.replace(/\D/g, '').slice(0, 12);
              }
              // Pin code: only digits, max 6
              if (label.includes('पिन कोड') || label.toLowerCase().includes('pin')) {
                value = value.replace(/\D/g, '').slice(0, 6);
              }
              // Total members: only digits, max 2
              if (label.includes('एकूण सदस्य') || label.includes('Total Members')) {
                value = value.replace(/\D/g, '').slice(0, 2);
              }
              // Numeric fields: only digits
              if (q.valid_input === 'numeric' || label.includes('पिन कोड') || label.toLowerCase().includes('pin') || isRationOrAadhar || label.includes('एकूण सदस्य')) {
                value = value.replace(/\D/g, '');
              }
              handleAnswerChange(q.id, value);
            }}
          />
        )}
      </div>
    );
  };

  if (currentStep === 'complete') {
    return (
      <div className="min-h-screen bg-[#003f86] bg-gradient-to-br from-[#003f86] to-[#009cc5] flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.05] mix-blend-overlay"></div>
        {/* Background Decor from main page */}
        <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] bg-white/10 rounded-full blur-[120px]"></div>
          <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] bg-white/10 rounded-full blur-[100px]"></div>
        </div>

        <div className="bg-white/95 backdrop-blur-xl rounded-[56px] p-12 md:p-20 text-center max-w-2xl shadow-[0_40px_100px_rgba(0,0,0,0.2)] animate-in zoom-in-95 duration-700 relative z-10 border border-white/40">
          <div className="w-32 h-32 bg-green-50 text-green-600 rounded-[40px] flex items-center justify-center mx-auto mb-12 shadow-inner animate-bounce">
            <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-6 tracking-tightest filter drop-shadow-sm">अभिनंदन !!</h2>
          <div className="space-y-4 mb-12">
            <p className="text-xl text-slate-600 font-bold leading-relaxed">
              अहिल्यानगर जिल्हा दिव्यांग सर्वेक्षण अभियानात आपण यशस्वीरित्या सहभाग नोंदवला आहे.
            </p>
            <p className="text-lg text-slate-500 font-medium leading-relaxed">
              यापुढील प्रक्रियेसाठी नजकीच्या आशा ताई, अंगणवाडीसेविका किंवा स्वयंसेवक आपल्याशी संपर्क करतील.
            </p>
            <p className="text-sm text-slate-400 font-bold uppercase tracking-wider pt-4 border-t border-slate-100">
              इतर माहितीसाठी संपर्क: ०२४१ २७७ ७७७२<br />धन्यवाद
            </p>
          </div>

          <Link href="/public" className="inline-flex items-center gap-4 px-12 py-6 bg-slate-950 text-white rounded-[32px] font-black uppercase tracking-[0.2em] shadow-2xl hover:bg-blue-900 hover:-translate-y-2 transition-all active:scale-95">
            <span className="text-xs">मुख्य पृष्ठ</span>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#003f86] bg-gradient-to-br from-[#003f86] to-[#009cc5] py-12 md:py-24 px-6 selection:bg-white selection:text-blue-600 relative">
      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] bg-white/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] bg-white/10 rounded-full blur-[100px]"></div>
      </div>

      <div className="max-w-4xl mx-auto relative z-10">
        <header className="mb-16 flex flex-col items-center text-center">
          <Link href="/public" className="group flex items-center gap-3 mb-10 px-6 py-2 rounded-full bg-slate-900/20 backdrop-blur-md border border-white/30 shadow-sm hover:bg-slate-900/30 transition-all no-underline">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}><path d="M15 19l-7-7 7-7" /></svg>
              Home
            </span>
          </Link>

          <div className="flex items-center gap-4 group">
            <div className="bg-white/10 backdrop-blur-md p-2 rounded-2xl shadow-xl transition-transform group-hover:rotate-3 group-hover:scale-110 border border-white/20">
              <Image src={LOGO_URL} alt="Logo" width={32} height={32} className="object-contain brightness-0 invert" />
            </div>
            <h1 className="text-4xl font-black text-white tracking-tightest uppercase italic drop-shadow-md">
              DDRC <span className="text-blue-100 not-italic">Ahilyanagar</span>
            </h1>
          </div>
        </header>

        <main className="bg-white/70 backdrop-blur-3xl border border-white/60 rounded-[64px] shadow-[0_40px_100px_rgba(0,0,0,0.06)] overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="bg-slate-950 px-10 py-12 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/30 via-transparent to-blue-500/20"></div>
            <div className="absolute -bottom-1 left-0 right-0 h-4 bg-white/10 blur-xl"></div>

            <h2 className="text-3xl md:text-4xl font-black text-white relative z-10 tracking-tight">नोंदणी प्रक्रिया</h2>
            <div className="mt-8 flex justify-center items-center gap-4 relative z-10">
              {stepsOrder.map((s, idx) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`h-2.5 rounded-full transition-all duration-700 ${currentStepIndex >= idx ? 'w-10 bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'w-4 bg-white/10'}`}></div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-8 md:p-16">
            {error && (
              <div className="p-6 mb-12 rounded-[28px] bg-red-50 border border-red-100 text-red-600 font-bold text-sm flex items-start gap-4 animate-in shake duration-500">
                <span className="text-xl">⚠️</span> {error}
              </div>
            )}

            {currentStep === 'upload-front' && (
              <div className="space-y-10 text-center animate-in fade-in zoom-in-95 duration-500">
                <div className="max-w-md mx-auto">
                  <div className="bg-blue-50/50 p-12 rounded-[48px] border border-blue-100/50 relative group">
                    <div className="text-6xl mb-6 scale-90 transition-transform group-hover:scale-100">📇</div>
                    <h3 className="text-2xl font-black text-blue-950 mb-3 tracking-tight">आधार कार्ड (पुढील बाजू)</h3>
                    <p className="text-xs font-bold text-blue-700/60 uppercase tracking-widest mb-10">Front Side Image</p>

                    <input type="file" id="f" className="hidden" accept="image/*" onChange={handleFrontImageUpload} />
                    <label htmlFor="f" className="relative block w-full aspect-[16/10] bg-white border-2 border-dashed border-blue-200 rounded-[32px] flex items-center justify-center cursor-pointer hover:bg-white hover:border-blue-500 hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 group overflow-hidden">
                      {frontImageUrl ? (
                        <div className="relative w-full h-full p-2">
                          <Image
                            src={getDisplayUrl(frontImageUrl)}
                            alt="Front Upload"
                            fill
                            className="object-contain"
                            unoptimized={true}
                          />
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-4">
                          <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 transition-transform group-hover:rotate-12">
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M12 4v16m8-8H4" /></svg>
                          </div>
                          <span className="font-black text-blue-600 uppercase text-[10px] tracking-[0.2em]">Select Photo</span>
                        </div>
                      )}
                    </label>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 'upload-back' && (
              <div className="space-y-10 text-center animate-in fade-in zoom-in-95 duration-500">
                <div className="max-w-md mx-auto">
                  <div className="bg-blue-50/50 p-12 rounded-[48px] border border-blue-100/50 relative group">
                    <div className="text-6xl mb-6 scale-90 transition-transform group-hover:scale-100">🆔</div>
                    <h3 className="text-2xl font-black text-blue-950 mb-3 tracking-tight">आधार कार्ड (मागील बाजू)</h3>
                    <p className="text-xs font-bold text-blue-700/60 uppercase tracking-widest mb-10">Back Side Image</p>

                    <input type="file" id="b" className="hidden" accept="image/*" onChange={handleBackImageUpload} />
                    <label htmlFor="b" className="relative block w-full aspect-[16/10] bg-white border-2 border-dashed border-blue-200 rounded-[32px] flex items-center justify-center cursor-pointer hover:bg-white hover:border-blue-500 hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 group overflow-hidden">
                      {backImageUrl ? (
                        <div className="relative w-full h-full p-2">
                          <Image
                            src={getDisplayUrl(backImageUrl)}
                            alt="Back Upload"
                            fill
                            className="object-contain"
                            unoptimized={true}
                          />
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-4">
                          <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 transition-transform group-hover:rotate-12">
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M12 4v16m8-8H4" /></svg>
                          </div>
                          <span className="font-black text-blue-600 uppercase text-[10px] tracking-[0.2em]">Select Photo</span>
                        </div>
                      )}
                    </label>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 'aadhar-info' && (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-500">
                <div className="bg-slate-50/50 p-10 md:p-14 rounded-[48px] border border-slate-100 shadow-inner grid gap-10">
                  <div className="group">
                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4 group-focus-within:text-blue-600 transition-colors">पूर्ण नाव (आधार प्रमाणे)</label>
                    <input
                      type="text"
                      id="survey_full_name"
                      placeholder="Enter Full Name"
                      className="w-full bg-white border border-slate-200 rounded-[28px] px-8 py-5 font-black text-lg outline-none focus:ring-[12px] focus:ring-blue-500/5 focus:border-blue-500 transition-all duration-300 shadow-sm"
                      value={divyangName}
                      onChange={(e) => setDivyangName(e.target.value)}
                    />
                  </div>
                  <div className="group">
                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4 group-focus-within:text-blue-600 transition-colors">आधार क्रमांक</label>
                    <div className="relative">
                      <input
                        type="text"
                        id="survey_aadhar_no"
                        placeholder="0000-0000-0000"
                        className="w-full bg-white border border-slate-200 rounded-[28px] px-8 py-5 font-black text-2xl tracking-[0.25em] outline-none focus:ring-[12px] focus:ring-blue-500/5 focus:border-blue-500 transition-all duration-300 shadow-sm"
                        value={aadharNo}
                        onChange={(e) => {
                          let v = e.target.value.replace(/\D/g, '').slice(0, 12);
                          setAadharNo(v.match(/.{1,4}/g)?.join('-') || v);
                          if (existingSurveyData) setExistingSurveyData(null); // Reset existing check
                          if (v.length === 12) checkExistingSurvey(v);
                        }}
                      />
                      {checkingExisting && (
                        <div className="absolute right-6 top-1/2 -translate-y-1/2">
                          <div className="w-6 h-6 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                        </div>
                      )}
                    </div>
                  </div>

                  {existingSurveyData && (
                    <div className="p-8 rounded-[32px] bg-amber-50/50 backdrop-blur-xl border border-amber-200/50 flex flex-col md:flex-row justify-between items-center gap-6 group hover:bg-amber-50 transition-colors">
                      <div className="flex flex-col gap-1">
                        <span className="font-black text-amber-900 text-lg">आधीच नोंदणीकृत आहात?</span>
                        <span className="text-xs font-bold text-amber-900/40 uppercase tracking-widest">You have an existing record.</span>
                      </div>
                      <button onClick={() => { if (existingSurveyData.answers) setAnswers(existingSurveyData.answers); setExistingSurveyData(null); }} className="px-10 py-4 bg-amber-200 text-amber-900 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-amber-300 transition-all shadow-md active:scale-95">माहिती भरा</button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {currentStep === 'personal-info' && (
              <div className="space-y-16 animate-in fade-in slide-in-from-bottom-8 duration-500">

                {allQuestions.length === 0 && (
                  <div className="p-4 bg-yellow-100 text-yellow-800 rounded mb-6 border border-yellow-200">
                    ⚠️ Warning: No questions loaded. Please refresh the page.
                  </div>
                )}
                {questionSections.map((s, i) => {
                  const visible = s.questions.filter(q => {
                    return shouldShowQuestion(q);
                  });

                  // Advanced sorting: place dependent questions immediately after their parents
                  const sorted: Question[] = [];
                  const added = new Set<string | number>();
                  const baseOrdered = [...visible].sort((a, b) => getQuestionIdNumber(a.id) - getQuestionIdNumber(b.id));

                  const addWithChildren = (q: Question) => {
                    if (added.has(q.id)) return;
                    sorted.push(q);
                    added.add(q.id);
                    baseOrdered.filter(child =>
                      child.rendering_question === q.question ||
                      child.rendering_question === q.id.toString()
                    ).forEach(addWithChildren);
                  };

                  baseOrdered.forEach(q => {
                    const hasParentInList = q.rendering_question && baseOrdered.some(p =>
                      p.question?.trim() === q.rendering_question?.trim() ||
                      p.id.toString() === q.rendering_question?.toString()
                    );
                    if (!hasParentInList) addWithChildren(q);
                  });
                  // Safety: add any missed questions
                  baseOrdered.forEach(q => { if (!added.has(q.id)) sorted.push(q); });
                  if (visible.length === 0) return null;
                  return (
                    <div key={i} className="space-y-10">
                      <div className="flex items-center gap-6">
                        <h4 className="text-[11px] font-black text-blue-600 uppercase tracking-[0.5em] whitespace-nowrap">{s.title}</h4>
                        <div className="h-[1px] bg-gradient-to-r from-blue-100 to-transparent flex-1"></div>
                      </div>
                      <div className="grid gap-8">{sorted.map(q => renderQuestion(q))}</div>
                    </div>
                  );
                })}
              </div>
            )}

            <footer className="mt-20 flex flex-col sm:flex-row gap-6">
              {currentStep !== 'upload-front' && (
                <button
                  onClick={() => setCurrentStep(prev => {
                    const idx = stepsOrder.indexOf(prev);
                    return idx > 0 ? stepsOrder[idx - 1] : 'upload-front';
                  })}
                  className="px-10 py-5 rounded-[28px] border-2 border-slate-100 font-black text-slate-400 hover:text-slate-900 hover:border-slate-200 transition-all uppercase tracking-[0.2em] text-[10px]"
                >
                  मागे
                </button>
              )}
              <button
                onClick={currentStep === 'personal-info' ? submitForm : (currentStep === 'aadhar-info' ? createAadharRecord : () => setCurrentStep(prev => stepsOrder[stepsOrder.indexOf(prev) + 1] as Step))}
                disabled={submitting || loading}
                id="survey_next_btn"
                className="flex-1 px-12 py-6 bg-slate-950 text-white rounded-[32px] font-black uppercase tracking-[0.3em] hover:bg-blue-900 transition-all duration-500 hover:shadow-[0_25px_60px_rgba(37,99,235,0.15)] active:scale-95 flex items-center justify-center gap-6 group disabled:opacity-50"
              >
                {submitting || loading ? (
                  <div className="w-6 h-6 border-3 border-white/20 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span className="text-sm">{currentStep === 'personal-info' ? 'सबमिट करा' : 'पुढे चला'}</span>
                    <svg className="w-5 h-5 transition-transform duration-500 group-hover:translate-x-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}><path d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                  </>
                )}
              </button>
            </footer>


          </div>
        </main>
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@100..900&display=swap');
        
        :root {
          --font-outfit: 'Outfit', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }

        body {
          font-family: var(--font-outfit);
          background-color: #F8FAFC;
        }

        .tracking-tightest {
          letter-spacing: -0.05em;
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        
        .shake {
          animation: shake 0.4s ease-in-out;
        }

        /* Custom scrollbar for premium feel */
        ::-webkit-scrollbar {
          width: 8px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #3b82f6;
        }
      `}</style>
    </div>
  );
}
