'use client';

import { useState, useEffect } from 'react';
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

  // Load questions on mount
  useEffect(() => {
    loadQuestions();
  }, []);

  const loadQuestions = async () => {
    setLoading(true);
    try {
      const response = await getQuestions();
      if (response.ok && response.data) {
        const questions = response.data as Question[];
        setAllQuestions(questions);

        // Filter personal info questions (title = "वैयक्तिक माहिती" OR section_id = 1)
        const personalInfo = questions.filter(
          (q) => q.title === 'वैयक्तिक माहिती' || q.section_id === 1
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
        // Get all question texts from personal info section
        const personalInfoQuestionTexts = new Set(
          personalInfo.map(q => q.question?.trim()).filter(Boolean)
        );
        
        // Include questions from other sections that depend on personal info questions
        const conditionalQuestions = questions.filter((q) => {
          // Skip if already in personalInfo or disabilityQuestions
          if (personalInfo.some(pq => pq.id === q.id) || 
              disabilityQuestions.some(dq => dq.id === q.id)) {
            return false;
          }
          
          // Include if it has a rendering condition pointing to a personal info question
          if (q.rendering_condition === 'Yes' || q.rendering_condition === 'yes') {
            const renderingQ = q.rendering_question?.trim();
            if (renderingQ && personalInfoQuestionTexts.has(renderingQ)) {
              return true;
            }
          }
          return false;
        });
        
        // Combine and sort by ID
        const allPersonalInfo = [...personalInfo, ...disabilityQuestions, ...conditionalQuestions].sort(
          (a, b) => (a.id || 0) - (b.id || 0)
        );
        setPersonalInfoQuestions(allPersonalInfo);

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
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
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

  const shouldShowQuestion = (q: Question): boolean => {
    if (!q.rendering_condition || q.rendering_condition === 'No') return true;

    if (!q.rendering_question) return false;

    // Try to find the rendering question by ID first, then by question text
    const renderingQuestion = allQuestions.find((x) => {
      // Match by ID if rendering_question is a number
      const renderingQId = parseInt(q.rendering_question?.toString() || '0');
      if (renderingQId > 0 && x.id === renderingQId) {
        return true;
      }
      // Match by exact question text
      const renderingQText = q.rendering_question?.trim();
      if (renderingQText && x.question?.trim() === renderingQText) {
        return true;
      }
      return false;
    });

    if (!renderingQuestion) {
      // Debug: log when rendering question is not found
      console.warn('Rendering question not found:', q.rendering_question, 'for question:', q.id);
      return false;
    }

    const renderingAnswer = answers[renderingQuestion.id];
    if (!renderingAnswer) return false;

    // Split rendering values and check if answer matches any of them
    const renderingValues = q.rendering_value?.split(',').map((v) => v.trim()) || [];
    const answerStr = renderingAnswer.toString().trim();
    
    // Check if answer matches any rendering value
    return renderingValues.some((val) => val.trim() === answerStr);
  };

  const renderQuestion = (q: Question) => {
    if (!shouldShowQuestion(q)) return null;

    const currentAnswer = answers[q.id];

    switch (q.question_type.toLowerCase()) {
      case 'mcq':
        const options = q.options?.split(',').map((o) => o.trim()) || [];
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
        return (
          <div key={q.id} className="mb-3 mb-md-4">
            <label className="form-label fw-semibold mb-2 d-block">{q.question}</label>
            <input
              type="text"
              className="form-control form-control-lg"
              value={currentAnswer || ''}
              onChange={(e) => handleAnswerChange(q.id, e.target.value)}
              maxLength={q.max_length || undefined}
              style={{ fontSize: '1rem', minHeight: '48px' }}
            />
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
      <div className="container-fluid px-3 py-4" style={{ minHeight: '100vh' }}>
        <div className="row justify-content-center">
          <div className="col-12 col-md-10 col-lg-8">
            <div className="card shadow-sm border-0">
              <div className="card-body text-center p-4 p-md-5">
                <div className="mb-4">
                  <div className="bg-success text-white rounded-circle d-inline-flex align-items-center justify-content-center" 
                       style={{ width: '80px', height: '80px', fontSize: '2.5rem' }}>
                    ✓
                  </div>
                </div>
                <h2 className="text-success mb-3 fw-bold">फॉर्म सबमिट झाला!</h2>
                <p className="lead mb-2">आपला फॉर्म यशस्वीरित्या सबमिट झाला आहे.</p>
                <p className="text-muted">धन्यवाद!</p>
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
                    {personalInfoQuestions.map((q) => renderQuestion(q))}
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

