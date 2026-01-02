'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { apiCall, getQuestions, submitAnswers, uploadImage } from '@/lib/api-client';

interface Question {
  id: number;
  section_id?: number;
  title?: string;
  question: string;
  question_type: string;
  multi_select?: number | string;
  options?: string;
  rendering_condition?: string;
  rendering_question?: string;
  rendering_value?: string;
  regex?: string;
  valid_input?: string;
  max_length?: number;
  status?: string;
}

type Step = 'upload-front' | 'upload-back' | 'aadhar-info' | 'personal-info' | 'address' | 'complete';

export default function PublicFormPage() {
  const [currentStep, setCurrentStep] = useState<Step>('upload-front');
  const [frontImage, setFrontImage] = useState<File | null>(null);
  const [backImage, setBackImage] = useState<File | null>(null);
  const [frontImageUrl, setFrontImageUrl] = useState<string>('');
  const [backImageUrl, setBackImageUrl] = useState<string>('');
  const [aadharNo, setAadharNo] = useState('');
  const [divyangName, setDivyangName] = useState('');
  const [aadharId, setAadharId] = useState<number | null>(null);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [personalInfoQuestions, setPersonalInfoQuestions] = useState<Question[]>([]);
  const [addressQuestions, setAddressQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // Address section state (for dynamic loading)
  const [talukas, setTalukas] = useState<string[]>([]);
  const [villages, setVillages] = useState<string[]>([]);
  const [grams, setGrams] = useState<string[]>([]);
  const [talathi, setTalathi] = useState<string[]>([]);
  const [phc, setPhc] = useState<string[]>([]);

  // Calculate age from date of birth
  const calculateAge = (dob: string): string => {
    if (!dob) return '';
    try {
      const birthDate = new Date(dob);
      if (isNaN(birthDate.getTime())) return '';
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age > 0 ? `${age} वर्षे` : '';
    } catch {
      return '';
    }
  };

  // Find question IDs by question text
  const getQuestionIdByText = (questionText: string): number | null => {
    const question = allQuestions.find(q => q.question?.trim() === questionText.trim());
    return question?.id || null;
  };

  // Reorder questions so conditional questions appear immediately after their parent
  const reorderQuestionsWithConditionals = (questions: Question[]): Question[] => {
    if (questions.length <= 1) return questions;

    // Build a map of parent question labels/IDs to their dependent questions
    const parentToChildren = new Map<string, Question[]>();
    
    // First pass: identify all conditional questions and group them by parent
    for (const q of questions) {
      const rawCondition = (q.rendering_condition || '').toString().trim().toLowerCase();
      const hasCondition = rawCondition === 'yes' || rawCondition === 'true' || rawCondition === '1';
      
      if (hasCondition && q.rendering_question) {
        const parentKey = q.rendering_question.trim();
        if (parentKey) {
          if (!parentToChildren.has(parentKey)) {
            parentToChildren.set(parentKey, []);
          }
          parentToChildren.get(parentKey)!.push(q);
        }
      }
    }
    
    // Second pass: rebuild the list ensuring conditional questions appear immediately after their parent
    const reordered: Question[] = [];
    const processed = new Set<number>();
    
    // Helper function to recursively add a question and all its dependents
    const addQuestionAndDependents = (q: Question) => {
      if (processed.has(q.id)) return;
      
      reordered.push(q);
      processed.add(q.id);
      
      // Add all questions that depend on this one (recursively handles nested dependencies)
      const qLabel = q.question?.trim() || '';
      const qId = q.id.toString();
      
      // Check by question text (exact match)
      if (parentToChildren.has(qLabel)) {
        for (const child of parentToChildren.get(qLabel)!) {
          addQuestionAndDependents(child);
        }
      }
      
      // Check by question ID (if rendering_question is a number)
      if (parentToChildren.has(qId)) {
        for (const child of parentToChildren.get(qId)!) {
          addQuestionAndDependents(child);
        }
      }
    };
    
    // Process all independent questions first (those without rendering conditions)
    // This ensures parents are processed before their dependents
    for (const q of questions) {
      if (processed.has(q.id)) continue;
      
      const rawCondition = (q.rendering_condition || '').toString().trim().toLowerCase();
      const hasCondition = rawCondition === 'yes' || rawCondition === 'true' || rawCondition === '1';
      
      if (!hasCondition) {
        // Independent question - add it and all its dependents
        addQuestionAndDependents(q);
      }
    }
    
    // Process any remaining dependent questions that weren't added (edge case: parent not in list)
    for (const q of questions) {
      if (!processed.has(q.id)) {
        addQuestionAndDependents(q);
      }
    }
    
    // If reordering didn't work or resulted in different length, fall back to original order
    if (reordered.length !== questions.length) {
      return questions.sort((a, b) => (a.id || 0) - (b.id || 0));
    }
    
    return reordered;
  };

  // Load questions on mount
  useEffect(() => {
    loadQuestions();
    loadTalukas();
  }, []);

  // Load talukas
  const loadTalukas = async () => {
    try {
      const response = await fetch('/api/get-talukas');
      const data = await response.json();
      if (data.ok && data.talukas) {
        setTalukas(data.talukas);
      }
    } catch (err) {
      console.error('Failed to load talukas:', err);
    }
  };

  // Load dependent data when taluka is selected
  const loadDependentData = async (taluka: string) => {
    if (!taluka) {
      setVillages([]);
      setGrams([]);
      setTalathi([]);
      setPhc([]);
      return;
    }

    try {
      const [villagesRes, gramsRes, talathiRes, phcRes] = await Promise.all([
        fetch(`/api/get-villages?taluka=${encodeURIComponent(taluka)}`),
        fetch(`/api/get-grams?taluka=${encodeURIComponent(taluka)}`),
        fetch(`/api/get-talathi?taluka=${encodeURIComponent(taluka)}`),
        fetch(`/api/get-phc?taluka=${encodeURIComponent(taluka)}`),
      ]);

      const villagesData = await villagesRes.json();
      const gramsData = await gramsRes.json();
      const talathiData = await talathiRes.json();
      const phcData = await phcRes.json();

      if (villagesData.ok) setVillages(villagesData.villages || []);
      if (gramsData.ok) setGrams(gramsData.grams || []);
      if (talathiData.ok) setTalathi(talathiData.talathi || []);
      if (phcData.ok) setPhc(phcData.phc || []);
    } catch (err) {
      console.error('Failed to load dependent data:', err);
    }
  };

  // Get question IDs for DOB and Age
  const dobQuestionId = useMemo(() => getQuestionIdByText('जन्म तारीख'), [allQuestions]);
  const ageQuestionId = useMemo(() => getQuestionIdByText('वय'), [allQuestions]);
  const prevDobRef = useRef<string>('');

  // Auto-calculate age when date of birth is set
  useEffect(() => {
    if (allQuestions.length > 0 && dobQuestionId && ageQuestionId) {
      const dobValue = answers[dobQuestionId]?.toString() || '';
      
      // Only update if DOB actually changed
      if (dobValue !== prevDobRef.current) {
        prevDobRef.current = dobValue;
        
        if (dobValue) {
          const calculatedAge = calculateAge(dobValue);
          if (calculatedAge) {
            setAnswers((prev) => ({ ...prev, [ageQuestionId]: calculatedAge }));
          }
        } else {
          // Clear age if DOB is cleared
          setAnswers((prev) => {
            const newAnswers = { ...prev };
            delete newAnswers[ageQuestionId];
            return newAnswers;
          });
        }
      }
    }
  }, [answers, allQuestions, dobQuestionId, ageQuestionId]);

  // Pre-fill name from Aadhar info section when moving to personal info step
  useEffect(() => {
    if (currentStep === 'personal-info' && divyangName && allQuestions.length > 0) {
      const nameQuestionId = getQuestionIdByText('दिव्यांगांचे नाव');
      if (nameQuestionId) {
        // Pre-fill if empty, or update if it matches the previous divyangName (to keep in sync)
        const currentNameAnswer = answers[nameQuestionId];
        if (!currentNameAnswer || currentNameAnswer === divyangName) {
          setAnswers((prev) => ({ ...prev, [nameQuestionId]: divyangName }));
        }
      }
    }
  }, [currentStep, divyangName, allQuestions.length]);

  // Pre-fill district and load dependent data when address step loads
  useEffect(() => {
    if (currentStep === 'address' && allQuestions.length > 0) {
      // Pre-fill district with "Ahilyanagar" if not set
      const districtQuestionId = getQuestionIdByText('सध्याचा जि.') || getQuestionIdByText('जि.');
      if (districtQuestionId && !answers[districtQuestionId]) {
        setAnswers((prev) => ({ ...prev, [districtQuestionId]: 'Ahilyanagar' }));
      }
      
      // Load dependent data if taluka is already selected
      const talukaQuestionId = getQuestionIdByText('सध्याचा ता.') || getQuestionIdByText('ता.');
      if (talukaQuestionId && answers[talukaQuestionId]) {
        const selectedTaluka = answers[talukaQuestionId];
        if (selectedTaluka && (villages.length === 0 || grams.length === 0)) {
          loadDependentData(selectedTaluka);
        }
      }
    }
  }, [currentStep, allQuestions.length]);

  const loadQuestions = async () => {
    setLoading(true);
    try {
      const response = await getQuestions();
      if (response.ok && response.data) {
        const questions = response.data as Question[];
        setAllQuestions(questions);

        // Filter personal info questions (title = "वैयक्तिक माहिती" OR section_id = 1)
        // Also filter out inactive questions (status !== 'Active')
        const personalInfo = questions.filter(
          (q) => (q.title === 'वैयक्तिक माहिती' || q.section_id === 1) &&
                 (q.status === 'Active' || !q.status || q.status === null)
        );
        
        // Add disability type, percentage, and UDID questions
        const disabilityQuestions = questions.filter(
          (q) => 
            q.title === 'दिव्यांगता तपशील' && (
              q.question.includes('दिव्यांगता प्रकार') ||
              q.question.includes('दिव्यांगता टक्केवारी') ||
              q.question.includes('वैश्विक कार्ड (UDID)') ||
              q.question === 'वैश्विक कार्ड (UDID)'
            )
        );
        
        // Find questions from other sections that have rendering conditions based on personal info questions
        // Get all question texts and IDs from personal info section
        const personalInfoQuestionTexts = new Set(
          personalInfo.map(q => q.question?.trim()).filter(Boolean)
        );
        const personalInfoQuestionIds = new Set(
          personalInfo.map(q => q.id).filter(Boolean)
        );
        
        // Include questions from other sections that depend on personal info questions
        const conditionalQuestions = questions.filter((q) => {
          // Skip if already in personalInfo or disabilityQuestions
          if (personalInfo.some(pq => pq.id === q.id) || 
              disabilityQuestions.some(dq => dq.id === q.id)) {
            return false;
          }
          
          // Include if it has a rendering condition pointing to a personal info question
          const rawCondition = (q.rendering_condition || '').toString().trim().toLowerCase();
          if (rawCondition === 'yes' || rawCondition === 'true' || rawCondition === '1') {
            const renderingQ = q.rendering_question?.trim();
            if (renderingQ) {
              // Check by question text
              if (personalInfoQuestionTexts.has(renderingQ)) {
                return true;
              }
              // Check by question ID
              const renderingQId = parseInt(renderingQ);
              if (renderingQId > 0 && personalInfoQuestionIds.has(renderingQId)) {
                return true;
              }
            }
          }
          return false;
        });
        
        // Combine all questions
        const allPersonalInfo = [...personalInfo, ...disabilityQuestions, ...conditionalQuestions];
        
        // Reorder questions so conditional questions appear immediately after their parent
        const reorderedQuestions = reorderQuestionsWithConditionals(allPersonalInfo);
        
        setPersonalInfoQuestions(reorderedQuestions);

        // Filter current address questions (title = "पत्ता" AND question starts with "सध्याचा")
        const currentAddress = questions.filter(
          (q) => q.title === 'पत्ता' && q.question.trim().startsWith('सध्याचा')
        );
        setAddressQuestions(currentAddress);
      }
    } catch (err: any) {
      setError('Questions लोड करण्यात अडचण: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFrontImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFrontImage(file);
      const url = URL.createObjectURL(file);
      setFrontImageUrl(url);
    }
  };

  const handleBackImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setBackImage(file);
      const url = URL.createObjectURL(file);
      setBackImageUrl(url);
    }
  };

  const handleNext = async () => {
    if (currentStep === 'upload-front') {
      if (!frontImage) {
        setError('कृपया आधार कार्डची पुढील बाजू अपलोड करा');
        return;
      }
      setCurrentStep('upload-back');
      setError('');
    } else if (currentStep === 'upload-back') {
      if (!backImage) {
        setError('कृपया आधार कार्डची मागील बाजू अपलोड करा');
        return;
      }
      setCurrentStep('aadhar-info');
      setError('');
    } else if (currentStep === 'aadhar-info') {
      if (!aadharNo.trim() || !divyangName.trim()) {
        setError('कृपया आधार क्रमांक आणि नाव प्रविष्ट करा');
        return;
      }
      // Validate Aadhar format (12 digits, optionally with dashes)
      const digits = aadharNo.replace(/\D/g, '');
      if (digits.length !== 12) {
        setError('कृपया वैध 12 अंकी आधार क्रमांक प्रविष्ट करा');
        return;
      }
      await createAadharRecord();
    } else if (currentStep === 'personal-info') {
      // Validate required fields
      const requiredQuestions = personalInfoQuestions.filter((q) => {
        if (q.rendering_condition === 'Yes' || q.rendering_condition === 'yes') {
          return shouldShowQuestion(q);
        }
        return true;
      });
      const missing = requiredQuestions.find((q) => !answers[q.id] || answers[q.id] === '');
      if (missing) {
        setError(`कृपया सर्व आवश्यक फील्ड भरा: ${missing.question}`);
        return;
      }
      
      // Validate mobile numbers (must be exactly 10 digits)
      for (const q of personalInfoQuestions) {
        if (q.question?.includes('मोबाईल') || q.question?.includes('Mobile')) {
          const mobileValue = answers[q.id];
          if (mobileValue && mobileValue.toString().trim()) {
            const digits = mobileValue.toString().replace(/\D/g, '');
            if (digits.length !== 10) {
              setError(`कृपया 10 अंकी मोबाईल नंबर प्रविष्ट करा: ${q.question}`);
              return;
            }
          }
        }
        
        // Validate email format
        if (q.question?.includes('ईमेल') || q.question?.includes('Email') || q.question?.includes('email')) {
          const emailValue = answers[q.id];
          if (emailValue && emailValue.toString().trim()) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(emailValue.toString().trim())) {
              setError(`कृपया वैध ईमेल आयडी प्रविष्ट करा: ${q.question}`);
              return;
            }
          }
        }
      }
      
      setCurrentStep('address');
      setError('');
    } else if (currentStep === 'address') {
      await submitForm();
    }
  };

  const handlePrev = () => {
    if (currentStep === 'upload-back') {
      setCurrentStep('upload-front');
    } else if (currentStep === 'aadhar-info') {
      setCurrentStep('upload-back');
    } else if (currentStep === 'personal-info') {
      setCurrentStep('aadhar-info');
    } else if (currentStep === 'address') {
      setCurrentStep('personal-info');
    }
    setError('');
  };

  const createAadharRecord = async () => {
    setLoading(true);
    setError('');
    try {
      // First upload images
      const formData = new FormData();
      formData.append('front_image', frontImage!);
      formData.append('back_image', backImage!);
      formData.append('aadhar_no', aadharNo);
      formData.append('divyang_name', divyangName);

      const uploadResponse = await fetch('/api/public/upload-aadhar', {
        method: 'POST',
        body: formData,
      });

      const uploadData = await uploadResponse.json();
      if (!uploadData.ok) {
        throw new Error(uploadData.error || 'Upload failed');
      }

      // Then create Aadhar record
      const createResponse = await apiCall('public/create-aadhar', {
        method: 'POST',
        body: JSON.stringify({
          aadhar_no: aadharNo,
          divyang_name: divyangName,
          front_image: uploadData.front_image,
          back_image: uploadData.back_image,
        }),
      });

      if (!createResponse.ok) {
        throw new Error(createResponse.error || 'Aadhar record creation failed');
      }

      setAadharId(createResponse.aadhar_id);
      
      // Pre-fill the name in personal info section
      if (divyangName && allQuestions.length > 0) {
        const nameQuestionId = getQuestionIdByText('दिव्यांगांचे नाव');
        if (nameQuestionId) {
          setAnswers((prev) => ({ ...prev, [nameQuestionId]: divyangName }));
        }
      }
      
      setCurrentStep('personal-info');
    } catch (err: any) {
      setError(err.message || 'त्रुटी आली. कृपया पुन्हा प्रयत्न करा.');
    } finally {
      setLoading(false);
    }
  };

  const submitForm = async () => {
    setSubmitting(true);
    setError('');
    try {
      if (!aadharId) {
        throw new Error('Aadhar ID not found');
      }

      // Combine all answers
      const allAnswers = [...personalInfoQuestions, ...addressQuestions]
        .filter((q) => shouldShowQuestion(q) && answers[q.id] !== undefined && answers[q.id] !== '')
        .map((q) => ({
          question_id: q.id,
          section_id: q.section_id || null,
          answer: Array.isArray(answers[q.id]) ? answers[q.id].join(',') : String(answers[q.id]),
        }));

      const response = await submitAnswers(1, aadharId, allAnswers, 'Divyang Self');
      if (!response.ok) {
        throw new Error(response.error || 'Form submission failed');
      }

      setCurrentStep('complete');
    } catch (err: any) {
      setError(err.message || 'Form सबमिट करण्यात अडचण. कृपया पुन्हा प्रयत्न करा.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAnswerChange = (questionId: number, value: any) => {
    setAnswers((prev) => {
      const newAnswers = { ...prev, [questionId]: value };
      
      // Auto-calculate age when date of birth changes
      const dobQuestionId = getQuestionIdByText('जन्म तारीख');
      const ageQuestionId = getQuestionIdByText('वय');
      
      if (questionId === dobQuestionId && ageQuestionId) {
        const age = calculateAge(value);
        if (age) {
          newAnswers[ageQuestionId] = age;
        }
      }
      
      // Handle taluka selection - load dependent data
      const question = allQuestions.find(q => q.id === questionId);
      if (question) {
        const label = question.question?.trim() || '';
        const isTaluka = label === 'ता.' || label === 'सध्याचा ता.' || label.includes('तालुका');
        
        if (isTaluka && value) {
          // Clear dependent fields when taluka changes
          const villageQuestionId = getQuestionIdByText('सध्याचा गाव') || getQuestionIdByText('गाव');
          const gramQuestionId = getQuestionIdByText('सध्याचा ग्रामपंचायत') || getQuestionIdByText('ग्रामपंचायत');
          const talathiQuestionId = getQuestionIdByText('सध्याचा तलाठी कार्यालय') || getQuestionIdByText('तलाठी कार्यालय');
          
          if (villageQuestionId) delete newAnswers[villageQuestionId];
          if (gramQuestionId) delete newAnswers[gramQuestionId];
          if (talathiQuestionId) delete newAnswers[talathiQuestionId];
          
          // Load dependent data
          loadDependentData(value);
        }
      }
      
      return newAnswers;
    });
    // Force re-render to show/hide conditional questions
    // The shouldShowQuestion function will be called during render
  };

  const handleFileUpload = async (questionId: number, file: File) => {
    setLoading(true);
    try {
      const uploadedUrl = await uploadImage(file);
      if (uploadedUrl) {
        handleAnswerChange(questionId, uploadedUrl);
      } else {
        setError('प्रतिमा अपलोड करण्यात अडचण आली. कृपया पुन्हा प्रयत्न करा.');
      }
    } catch (err: any) {
      setError('प्रतिमा अपलोड करण्यात अडचण: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Normalize string for comparison (trim whitespace, lowercase)
  const normalizeValue = (value: string): string => {
    return value.trim();
  };

  // Expand multi-answer values (handle arrays and pipe-separated values)
  const expandMultiAnswerValues = (answer: any): string[] => {
    if (!answer) return [];
    
    // Handle arrays (multi-select)
    if (Array.isArray(answer)) {
      return answer.map(v => normalizeValue(String(v))).filter(v => v.length > 0);
    }
    
    const answerStr = String(answer).trim();
    if (!answerStr) return [];
    
    // Handle pipe-separated values (||)
    const parts = answerStr.split('||');
    const values: string[] = [];
    
    for (const part of parts) {
      const segment = part.trim();
      if (!segment) continue;
      
      // Handle format like "key: value" - extract value part
      const clean = segment.includes(':') 
        ? segment.substring(segment.indexOf(':') + 1).trim()
        : segment;
      
      if (clean) {
        values.push(normalizeValue(clean));
      }
    }
    
    // If no values extracted, use the original answer
    if (values.length === 0) {
      values.push(normalizeValue(answerStr));
    }
    
    return values;
  };

  const shouldShowQuestion = (q: Question): boolean => {
    // Check rendering condition - if empty, 'No', 'false', or '0', show the question
    const rawCondition = (q.rendering_condition || '').toString().trim().toLowerCase();
    if (!rawCondition || rawCondition === 'no' || rawCondition === 'false' || rawCondition === '0') {
      return true;
    }

    // Must have rendering_question and rendering_value for conditional rendering
    const targetLabel = (q.rendering_question || '').toString().trim();
    const expectedRaw = (q.rendering_value || '').toString().trim();

    if (!targetLabel || !expectedRaw) {
      return true; // Show if condition data is incomplete
    }

    // Exclude current question ID when searching for rendering question to avoid self-reference
    const currentQid = q.id || 0;

    // Try to find the rendering question by ID first, then by question text
    const renderingQuestion = allQuestions.find((x) => {
      // Skip self-reference
      if (x.id === currentQid) return false;
      
      // Match by ID if rendering_question is a number
      const renderingQId = parseInt(targetLabel);
      if (renderingQId > 0 && x.id === renderingQId) {
        return true;
      }
      
      // Match by exact question text
      if (x.question?.trim() === targetLabel) {
        return true;
      }
      
      return false;
    });

    if (!renderingQuestion) {
      // Debug: log when rendering question is not found
      console.warn('Rendering question not found:', targetLabel, 'for question:', q.id);
      return false;
    }

    const renderingAnswer = answers[renderingQuestion.id];
    if (!renderingAnswer) return false;

    // Expand actual answer values (handle arrays, pipe-separated, etc.)
    const actualValues = expandMultiAnswerValues(renderingAnswer);
    if (actualValues.length === 0) return false;

    // Split expected values by comma or pipe, normalize them
    const expectedValues = expectedRaw
      .split(/[|,]/) // Split by pipe or comma
      .map(e => normalizeValue(e))
      .filter(e => e.length > 0);

    if (expectedValues.length === 0) return false;

    // Check if any expected value matches any actual value
    return expectedValues.some(expected => 
      actualValues.some(actual => actual === expected)
    );
  };

  const renderQuestion = (q: Question) => {
    if (!shouldShowQuestion(q)) return null;

    const currentAnswer = answers[q.id];
    const label = q.question?.trim() || '';
    
    // Check if this is an address field
    const isDistrict = label === 'जि.' || label === 'सध्याचा जि.';
    const isTaluka = label === 'ता.' || label === 'सध्याचा ता.' || label.includes('तालुका');
    const isVillage = label === 'गाव' || label === 'सध्याचा गाव' || label.includes('गाव / शहर');
    const isGram = label.includes('ग्रामपंचायत');
    const isTalathi = label.includes('तलाठी कार्यालय');
    const isPhc = label.includes('PHC') || label.includes('प्राथमिक आरोग्य केंद्र');

    switch (q.question_type.toLowerCase()) {
      case 'mcq':
        // For address fields, use dynamic options
        let options: string[] = [];
        if (isTaluka) {
          // Use loaded talukas if available, otherwise fall back to question options
          options = talukas.length > 0 ? talukas : (q.options?.split(',').map((o) => o.trim()).filter(o => o && o !== '--Select--') || []);
        } else if (isVillage && villages.length > 0) {
          options = villages;
        } else if (isGram && grams.length > 0) {
          options = grams;
        } else if (isTalathi && talathi.length > 0) {
          options = talathi;
        } else if (isPhc && phc.length > 0) {
          options = phc;
        } else {
          options = q.options?.split(',').map((o) => o.trim()).filter(o => o && o !== '--Select--') || [];
        }
        
        const isMultiSelect = q.multi_select === 1 || q.multi_select === '1';

        if (isMultiSelect) {
          const selectedValues = Array.isArray(currentAnswer) ? currentAnswer : [];
          return (
            <div key={q.id} className="mb-3 mb-md-4">
              <label className="form-label fw-semibold mb-2 d-block">{q.question}</label>
              <div className="ps-2">
                {options.map((opt, idx) => (
                  <div key={idx} className="form-check mb-2 py-2" style={{ minHeight: '44px' }}>
                    <input
                      className="form-check-input"
                      type="checkbox"
                      checked={selectedValues.includes(opt)}
                      onChange={(e) => {
                        const newValues = e.target.checked
                          ? [...selectedValues, opt]
                          : selectedValues.filter((v) => v !== opt);
                        handleAnswerChange(q.id, newValues);
                      }}
                      style={{ width: '1.25rem', height: '1.25rem', marginTop: '0.25rem' }}
                    />
                    <label className="form-check-label ms-2" style={{ fontSize: '0.95rem', cursor: 'pointer' }}>
                      {opt}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          );
        } else {
          return (
            <div key={q.id} className="mb-3 mb-md-4">
              <label className="form-label fw-semibold mb-2 d-block">{q.question}</label>
              <select
                className="form-select form-select-lg"
                value={currentAnswer || ''}
                onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                style={{ fontSize: '1rem', minHeight: '48px' }}
              >
                <option value="">-- निवडा --</option>
                {options.map((opt, idx) => (
                  <option key={idx} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          );
        }

      case 'short_answer':
      case 'text':
        // Check if this is a mobile number field
        const isMobileField = q.question?.includes('मोबाईल') || q.question?.includes('Mobile');
        // Check if this is an email field
        const isEmailField = q.question?.includes('ईमेल') || q.question?.includes('Email') || q.question?.includes('email');
        // Check if this is the age field (should be read-only)
        const isAgeField = q.question?.trim() === 'वय';
        
        // District field: always default to "Ahilyanagar"
        if (isDistrict) {
          const districtValue = currentAnswer || 'Ahilyanagar';
          
          return (
            <div key={q.id} className="mb-3 mb-md-4">
              <label className="form-label fw-semibold mb-2 d-block">{q.question}</label>
              <input
                type="text"
                className="form-control form-control-lg"
                value={districtValue}
                onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                style={{ fontSize: '1rem', minHeight: '48px' }}
              />
            </div>
          );
        }
        
        // Gram Panchayat should always be a dropdown, even if question_type is 'text'
        if (isGram && grams.length > 0) {
          return (
            <div key={q.id} className="mb-3 mb-md-4">
              <label className="form-label fw-semibold mb-2 d-block">{q.question}</label>
              <select
                className="form-select form-select-lg"
                value={currentAnswer || ''}
                onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                style={{ fontSize: '1rem', minHeight: '48px' }}
              >
                <option value="">-- निवडा --</option>
                {grams.map((opt, idx) => (
                  <option key={idx} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          );
        }
        
        return (
          <div key={q.id} className="mb-3 mb-md-4">
            <label className="form-label fw-semibold mb-2 d-block">{q.question}</label>
            <input
              type={isEmailField ? 'email' : 'text'}
              className="form-control form-control-lg"
              value={currentAnswer || ''}
              onChange={(e) => {
                let value = e.target.value;
                
                // Mobile number validation: only digits, max 10
                if (isMobileField) {
                  value = value.replace(/\D/g, ''); // Remove non-digits
                  if (value.length > 10) {
                    value = value.slice(0, 10);
                  }
                }
                
                handleAnswerChange(q.id, value);
              }}
              onBlur={(e) => {
                // Validate on blur
                const value = e.target.value.trim();
                
                if (isMobileField && value && value.length !== 10) {
                  setError('कृपया 10 अंकी मोबाईल नंबर प्रविष्ट करा');
                } else if (isEmailField && value) {
                  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                  if (!emailRegex.test(value)) {
                    setError('कृपया वैध ईमेल आयडी प्रविष्ट करा');
                  } else {
                    setError('');
                  }
                } else if (isMobileField && value && value.length === 10) {
                  setError(''); // Clear error if mobile is valid
                }
              }}
              readOnly={isAgeField}
              maxLength={isMobileField ? 10 : (q.max_length || undefined)}
              style={{ fontSize: '1rem', minHeight: '48px', backgroundColor: isAgeField ? '#e9ecef' : undefined }}
              placeholder={isMobileField ? '10 अंकी मोबाईल नंबर' : isEmailField ? 'example@email.com' : undefined}
            />
            {isAgeField && currentAnswer && (
              <small className="form-text text-muted d-block mt-1">वय आपोआप मोजले गेले आहे</small>
            )}
          </div>
        );

      case 'long_answer':
        return (
          <div key={q.id} className="mb-3 mb-md-4">
            <label className="form-label fw-semibold mb-2 d-block">{q.question}</label>
            <textarea
              className="form-control"
              rows={4}
              value={currentAnswer || ''}
              onChange={(e) => handleAnswerChange(q.id, e.target.value)}
              maxLength={q.max_length || undefined}
              style={{ fontSize: '1rem', minHeight: '100px' }}
            />
          </div>
        );

      case 'date':
        return (
          <div key={q.id} className="mb-3 mb-md-4">
            <label className="form-label fw-semibold mb-2 d-block">{q.question}</label>
            <input
              type="date"
              className="form-control form-control-lg"
              value={currentAnswer || ''}
              onChange={(e) => handleAnswerChange(q.id, e.target.value)}
              style={{ fontSize: '1rem', minHeight: '48px' }}
            />
          </div>
        );

      case 'number':
        return (
          <div key={q.id} className="mb-3 mb-md-4">
            <label className="form-label fw-semibold mb-2 d-block">{q.question}</label>
            <input
              type="number"
              className="form-control form-control-lg"
              value={currentAnswer || ''}
              onChange={(e) => handleAnswerChange(q.id, e.target.value)}
              style={{ fontSize: '1rem', minHeight: '48px' }}
            />
          </div>
        );

      case 'upload':
        return (
          <div key={q.id} className="mb-3 mb-md-4">
            <label className="form-label fw-semibold mb-2 d-block">{q.question}</label>
            <input
              type="file"
              className="form-control form-control-lg"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleFileUpload(q.id, file);
                }
              }}
              disabled={loading}
              style={{ fontSize: '1rem', minHeight: '48px' }}
            />
            {currentAnswer && (
              <div className="mt-3">
                <img
                  src={currentAnswer}
                  alt="Uploaded"
                  className="img-fluid rounded shadow-sm"
                  style={{ maxHeight: '200px', maxWidth: '100%', border: '2px solid #dee2e6' }}
                />
                <p className="text-success small mt-2 mb-0">
                  ✓ प्रतिमा अपलोड झाली
                </p>
              </div>
            )}
          </div>
        );

      default:
        return (
          <div key={q.id} className="mb-3 mb-md-4">
            <label className="form-label fw-semibold mb-2 d-block">{q.question}</label>
            <input
              type="text"
              className="form-control form-control-lg"
              value={currentAnswer || ''}
              onChange={(e) => handleAnswerChange(q.id, e.target.value)}
              style={{ fontSize: '1rem', minHeight: '48px' }}
            />
          </div>
        );
    }
  };

  if (loading && allQuestions.length === 0) {
    return (
      <div className="container-fluid px-3 py-4" style={{ minHeight: '100vh' }}>
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
            <span className="visually-hidden">लोड होत आहे...</span>
          </div>
          <p className="mt-3 text-muted">लोड होत आहे...</p>
        </div>
      </div>
    );
  }

  if (currentStep === 'complete') {
    return (
      <div className="container-fluid px-3 py-4" style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0D47A1 0%, #1976D2 50%, #42A5F5 100%)' }}>
        <div className="row justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
          <div className="col-12 col-md-8 col-lg-6">
            <div className="card shadow-lg border-0" style={{ borderRadius: '20px', overflow: 'hidden' }}>
              <div className="card-body text-center p-5 p-md-6" style={{ background: 'linear-gradient(to bottom, #ffffff 0%, #f8f9fa 100%)' }}>
                {/* Animated Success Icon */}
                <div className="mb-4" style={{ animation: 'scaleIn 0.5s ease-out' }}>
                  <div 
                    className="rounded-circle d-inline-flex align-items-center justify-content-center shadow-lg"
                    style={{ 
                      width: '120px', 
                      height: '120px', 
                      background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                      position: 'relative',
                      animation: 'bounceIn 0.8s ease-out'
                    }}
                  >
                    <svg 
                      width="60" 
                      height="60" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="white" 
                      strokeWidth="3" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                      style={{ animation: 'checkmark 0.5s ease-out 0.3s both' }}
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    {/* Ripple effect */}
                    <div 
                      className="position-absolute rounded-circle"
                      style={{
                        width: '120px',
                        height: '120px',
                        background: 'rgba(40, 167, 69, 0.2)',
                        animation: 'ripple 1.5s ease-out infinite',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        zIndex: -1
                      }}
                    />
                  </div>
                </div>
                
                {/* Success Message */}
                <h2 
                  className="mb-3 fw-bold" 
                  style={{ 
                    color: '#28a745',
                    fontSize: '2rem',
                    animation: 'fadeInUpSuccess 0.6s ease-out 0.2s both'
                  }}
                >
                  फॉर्म सबमिट झाला!
                </h2>
                
                <p 
                  className="lead mb-3" 
                  style={{ 
                    color: '#495057',
                    fontSize: '1.15rem',
                    animation: 'fadeInUpSuccess 0.6s ease-out 0.4s both'
                  }}
                >
                  आपला फॉर्म यशस्वीरित्या सबमिट झाला आहे.
                </p>
                
                <p 
                  className="mb-4" 
                  style={{ 
                    color: '#6c757d',
                    fontSize: '1rem',
                    fontWeight: '500',
                    animation: 'fadeInUpSuccess 0.6s ease-out 0.6s both'
                  }}
                >
                  धन्यवाद!
                </p>
                
                {/* Decorative elements */}
                <div className="mt-4 pt-4 border-top">
                  <div className="d-flex justify-content-center gap-2">
                    <div 
                      className="rounded-circle"
                      style={{ 
                        width: '8px', 
                        height: '8px', 
                        background: '#28a745',
                        animation: 'pulse 1.5s ease-in-out infinite 0.8s'
                      }}
                    />
                    <div 
                      className="rounded-circle"
                      style={{ 
                        width: '8px', 
                        height: '8px', 
                        background: '#28a745',
                        animation: 'pulse 1.5s ease-in-out infinite 1s'
                      }}
                    />
                    <div 
                      className="rounded-circle"
                      style={{ 
                        width: '8px', 
                        height: '8px', 
                        background: '#28a745',
                        animation: 'pulse 1.5s ease-in-out infinite 1.2s'
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid px-3 py-3 py-md-4" style={{ minHeight: '100vh', backgroundColor: '#f8f9fa' }}>
      <div className="row justify-content-center">
        <div className="col-12 col-md-10 col-lg-8">
          <div className="card shadow-sm border-0">
            <div className="card-header bg-primary text-white py-3">
              <h3 className="mb-0 text-center fw-bold" style={{ fontSize: '1.25rem' }}>दिव्यांग नोंदणी फॉर्म</h3>
            </div>
            <div className="card-body p-3 p-md-4">
              {/* Progress indicator */}
              <div className="mb-4">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <small className="text-muted fw-semibold">प्रगती</small>
                  <small className="text-muted fw-semibold">
                    {['upload-front', 'upload-back', 'aadhar-info', 'personal-info', 'address'].indexOf(currentStep) + 1} / 5
                  </small>
                </div>
                <div className="progress" style={{ height: '25px', borderRadius: '12px' }}>
                  <div
                    className="progress-bar progress-bar-striped progress-bar-animated bg-primary"
                    role="progressbar"
                    style={{
                      width: `${((['upload-front', 'upload-back', 'aadhar-info', 'personal-info', 'address'].indexOf(currentStep) + 1) / 5) * 100}%`,
                    }}
                  >
                    <span className="small fw-semibold">
                      {['upload-front', 'upload-back', 'aadhar-info', 'personal-info', 'address'].indexOf(currentStep) + 1} / 5
                    </span>
                  </div>
                </div>
              </div>

              {error && (
                <div className="alert alert-danger alert-dismissible fade show" role="alert">
                  <strong>त्रुटी:</strong> {error}
                  <button type="button" className="btn-close" onClick={() => setError('')} aria-label="Close"></button>
                </div>
              )}

              {/* Step 1: Upload Front */}
              {currentStep === 'upload-front' && (
                <div>
                  <h4 className="mb-3 mb-md-4 text-center text-md-start" style={{ fontSize: '1.1rem' }}>
                    चरण 1: आधार कार्डची पुढील बाजू अपलोड करा
                  </h4>
                  <div className="mb-3">
                    <label className="form-label fw-semibold mb-2">पुढील बाजू (Front) *</label>
                    <input
                      type="file"
                      className="form-control form-control-lg"
                      accept="image/*"
                      onChange={handleFrontImageUpload}
                      style={{ fontSize: '0.95rem' }}
                    />
                    {frontImageUrl && (
                      <div className="mt-3 text-center">
                        <img
                          src={frontImageUrl}
                          alt="Front"
                          className="img-fluid rounded shadow-sm"
                          style={{ maxHeight: '250px', maxWidth: '100%', border: '2px solid #dee2e6' }}
                        />
                        <p className="text-success small mt-2 mb-0">
                          ✓ प्रतिमा अपलोड झाली
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 2: Upload Back */}
              {currentStep === 'upload-back' && (
                <div>
                  <h4 className="mb-3 mb-md-4 text-center text-md-start" style={{ fontSize: '1.1rem' }}>
                    चरण 2: आधार कार्डची मागील बाजू अपलोड करा
                  </h4>
                  <div className="mb-3">
                    <label className="form-label fw-semibold mb-2">मागील बाजू (Back) *</label>
                    <input
                      type="file"
                      className="form-control form-control-lg"
                      accept="image/*"
                      onChange={handleBackImageUpload}
                      style={{ fontSize: '0.95rem' }}
                    />
                    {backImageUrl && (
                      <div className="mt-3 text-center">
                        <img
                          src={backImageUrl}
                          alt="Back"
                          className="img-fluid rounded shadow-sm"
                          style={{ maxHeight: '250px', maxWidth: '100%', border: '2px solid #dee2e6' }}
                        />
                        <p className="text-success small mt-2 mb-0">
                          ✓ प्रतिमा अपलोड झाली
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 3: Aadhar Info */}
              {currentStep === 'aadhar-info' && (
                <div>
                  <h4 className="mb-3 mb-md-4 text-center text-md-start" style={{ fontSize: '1.1rem' }}>
                    चरण 3: आधार कार्ड माहिती
                  </h4>
                  <div className="mb-3">
                    <label className="form-label fw-semibold mb-2">दिव्यांगांचे नाव *</label>
                    <input
                      type="text"
                      className="form-control form-control-lg"
                      value={divyangName}
                      onChange={(e) => setDivyangName(e.target.value)}
                      placeholder="दिव्यांगांचे पूर्ण नाव प्रविष्ट करा"
                      required
                      style={{ fontSize: '1rem' }}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-semibold mb-2">आधार क्रमांक *</label>
                    <input
                      type="text"
                      className="form-control form-control-lg"
                      value={aadharNo}
                      onChange={(e) => setAadharNo(e.target.value)}
                      placeholder="1234-5678-9012"
                      maxLength={14}
                      required
                      style={{ fontSize: '1rem' }}
                    />
                    <small className="form-text text-muted d-block mt-1">12 अंकी आधार क्रमांक प्रविष्ट करा</small>
                  </div>
                </div>
              )}

              {/* Step 4: Personal Info */}
              {currentStep === 'personal-info' && (
                <div>
                  <h4 className="mb-3 mb-md-4 text-center text-md-start" style={{ fontSize: '1.1rem' }}>
                    चरण 4: वैयक्तिक माहिती
                  </h4>
                  <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                    {(() => {
                      // Filter visible questions and reorder them dynamically based on current answers
                      const visibleQuestions = personalInfoQuestions.filter(q => shouldShowQuestion(q));
                      const reordered = reorderQuestionsWithConditionals(visibleQuestions);
                      return reordered.map((q) => renderQuestion(q));
                    })()}
                  </div>
                </div>
              )}

              {/* Step 5: Current Address */}
              {currentStep === 'address' && (
                <div>
                  <h4 className="mb-3 mb-md-4 text-center text-md-start" style={{ fontSize: '1.1rem' }}>
                    चरण 5: सध्याचा पत्ता
                  </h4>
                  <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                    {addressQuestions.map((q) => renderQuestion(q))}
                  </div>
                </div>
              )}

              {/* Navigation buttons */}
              <div className="mt-4 pt-3 border-top">
                <div className="d-flex flex-column flex-sm-row gap-2 justify-content-between">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-lg flex-fill flex-sm-grow-0"
                    onClick={handlePrev}
                    disabled={currentStep === 'upload-front' || loading || submitting}
                    style={{ minHeight: '48px', fontSize: '1rem' }}
                  >
                    ← मागे
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-lg flex-fill flex-sm-grow-0"
                    onClick={handleNext}
                    disabled={loading || submitting}
                    style={{ minHeight: '48px', fontSize: '1rem' }}
                  >
                    {loading || submitting ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" />
                        प्रक्रिया होत आहे...
                      </>
                    ) : currentStep === 'address' ? (
                      <>
                        ✓ सबमिट करा
                      </>
                    ) : (
                      <>
                        पुढे →
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

