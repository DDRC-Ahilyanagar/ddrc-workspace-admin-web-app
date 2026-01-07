'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface Question {
  id: number;
  section_id: number;
  question: string;
  question_type: string;
  multi_select: string;
  options: string | null;
  is_required: number;
  section_name?: string;
}

interface Section {
  id: number;
  name: string;
  questions: Question[];
}

function PublicSurveyFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const aadharId = searchParams.get('aadhar_id');

  const [sections, setSections] = useState<Section[]>([]);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState(false);
  const [fieldOfficer, setFieldOfficer] = useState<{ name: string; phone: string } | null>(null);

  useEffect(() => {
    if (!aadharId) {
      setError('आधार ID आवश्यक आहे. कृपया पुन्हा आधार कार्ड अपलोड करा.');
      setLoading(false);
      return;
    }

    // Load Aadhaar info from sessionStorage to prefill Aadhaar number
    const savedAadhaarInfo = sessionStorage.getItem('public_aadhaar_info');
    if (savedAadhaarInfo) {
      try {
        const aadhaarInfo = JSON.parse(savedAadhaarInfo);
        if (aadhaarInfo.aadhaar) {
          // Extract just the digits from Aadhaar number
          const aadhaarNumber = aadhaarInfo.aadhaar.replace(/\D/g, '');
          // Find and prefill Aadhaar number question (usually question ID around 53-63 in ओळखपत्र section)
          // We'll prefill it after questions are loaded
          sessionStorage.setItem('prefill_aadhaar', aadhaarNumber);
        }
      } catch (e) {
        console.error('Failed to parse Aadhaar info:', e);
      }
    }

    loadQuestions();
  }, [aadharId]);

  const loadQuestions = async () => {
    try {
      const res = await fetch('/api/get-questions');
      const data = await res.json();
      
      if (data.ok && data.data) {
        // Filter questions to only show:
        // 1. वैयक्तिक माहिती (Personal Information) - all questions
        // 2. पत्ता (Address) - Current only (questions without "स्थायी" or "permanent")
        // 3. दिव्यांगता तपशील (Disability Details) - only Type (69), percentage (70), UDID yes/no (66)
        
        const allowedSections = ['वैयक्तिक माहिती', 'पत्ता', 'दिव्यांगता तपशील'];
        const allowedDisabilityQuestions = [66, 69, 70]; // UDID yes/no, Type, Percentage
        
        const filteredQuestions = data.data.filter((q: Question) => {
          const sectionName = q.section_name || '';
          
          // Check if section is allowed
          if (!allowedSections.includes(sectionName)) {
            return false;
          }
          
          // For पत्ता section, only show "Current" address (exclude permanent)
          if (sectionName === 'पत्ता') {
            const questionText = (q.question || '').toLowerCase();
            // Exclude permanent address questions
            if (questionText.includes('स्थायी') || questionText.includes('permanent')) {
              return false;
            }
          }
          
          // For दिव्यांगता तपशील section, only show specific questions
          if (sectionName === 'दिव्यांगता तपशील') {
            return allowedDisabilityQuestions.includes(q.id);
          }
          
          return true;
        });
        
        // Group filtered questions by section
        const sectionsMap: Record<number, Section> = {};
        
        filteredQuestions.forEach((q: Question) => {
          if (!sectionsMap[q.section_id]) {
            sectionsMap[q.section_id] = {
              id: q.section_id,
              name: q.section_name || `Section ${q.section_id}`,
              questions: [],
            };
          }
          sectionsMap[q.section_id].questions.push(q);
        });

        // Sort sections in order: वैयक्तिक माहिती, पत्ता, दिव्यांगता तपशील
        const sectionOrder = ['वैयक्तिक माहिती', 'पत्ता', 'दिव्यांगता तपशील'];
        const sortedSections = Object.values(sectionsMap).sort((a, b) => {
          const aIndex = sectionOrder.indexOf(a.name);
          const bIndex = sectionOrder.indexOf(b.name);
          if (aIndex === -1 && bIndex === -1) return 0;
          if (aIndex === -1) return 1;
          if (bIndex === -1) return -1;
          return aIndex - bIndex;
        });

        // Prefill Aadhaar number if available
        const prefillAadhaar = sessionStorage.getItem('prefill_aadhaar');
        if (prefillAadhaar) {
          // Find Aadhaar number question (question ID 54 "आधार कार्ड नंबर")
          const allAadhaarQuestion = data.data.find((q: Question) => {
            const questionText = (q.question || '').toLowerCase();
            return q.id === 54 || 
                   ((questionText.includes('आधार') || questionText.includes('aadhaar') || questionText.includes('aadhar')) && 
                    (questionText.includes('नंबर') || questionText.includes('number')));
          });
          
          if (allAadhaarQuestion) {
            // Add Aadhaar number question to the first section (वैयक्तिक माहिती) if not already included
            const isAlreadyIncluded = filteredQuestions.find((q: Question) => q.id === allAadhaarQuestion.id);
            if (!isAlreadyIncluded && sortedSections.length > 0) {
              // Find वैयक्तिक माहिती section
              const personalInfoSection = sortedSections.find(s => s.name === 'वैयक्तिक माहिती');
              if (personalInfoSection) {
                // Add at the beginning of the section
                personalInfoSection.questions.unshift(allAadhaarQuestion);
              }
            }
            
            // Prefill the answer
            setAnswers((prev) => ({
              ...prev,
              [allAadhaarQuestion.id]: prefillAadhaar,
            }));
            console.log('Prefilled Aadhaar number:', prefillAadhaar, 'in question:', allAadhaarQuestion.id);
          }
        }

        setSections(sortedSections);
      } else {
        setError('प्रश्न लोड करण्यात त्रुटी आली');
      }
    } catch (err: any) {
      setError('प्रश्न लोड करण्यात त्रुटी आली: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (questionId: number, value: string) => {
    setAnswers((prev) => {
      const newAnswers = { ...prev, [questionId]: value };
      
      // Check if village question was answered and fetch field officer
      const question = sections.flatMap(s => s.questions).find(q => q.id === questionId);
      if (question && (question.question?.toLowerCase().includes('गाव') || question.question?.toLowerCase().includes('village'))) {
        // Village was updated, fetch field officer
        fetchFieldOfficer(value, newAnswers);
      }
      
      return newAnswers;
    });
  };

  const fetchFieldOfficer = async (village: string, currentAnswers: Record<number, string>) => {
    if (!village || village.trim().length === 0) {
      setFieldOfficer(null);
      return;
    }

    try {
      // Get taluka from answers if available
      const talukaQuestion = sections
        .flatMap(s => s.questions)
        .find(q => q.question?.toLowerCase().includes('तालुका') || q.question?.toLowerCase().includes('taluka'));
      const taluka = talukaQuestion ? currentAnswers[talukaQuestion.id] : '';

      const params = new URLSearchParams({ village });
      if (taluka) params.append('taluka', taluka);

      const response = await fetch(`/api/field-officer-by-village?${params.toString()}`);
      const data = await response.json();

      if (data.ok && data.officer) {
        setFieldOfficer({
          name: data.officer.name,
          phone: data.officer.phone || '',
        });
      } else {
        setFieldOfficer(null);
      }
    } catch (err) {
      console.error('Error fetching field officer:', err);
      setFieldOfficer(null);
    }
  };

  const validateCurrentSection = (): boolean => {
    const currentSection = sections[currentSectionIndex];
    if (!currentSection) return true;

    for (const question of currentSection.questions) {
      if (question.is_required === 1) {
        const answer = answers[question.id];
        if (!answer || answer.trim() === '') {
          setError(`कृपया "${question.question}" या प्रश्नाचे उत्तर द्या`);
          return false;
        }
      }
    }
    return true;
  };

  const handleNext = () => {
    if (!validateCurrentSection()) return;
    
    if (currentSectionIndex < sections.length - 1) {
      setCurrentSectionIndex(currentSectionIndex + 1);
      setError('');
    }
  };

  const handlePrev = () => {
    if (currentSectionIndex > 0) {
      setCurrentSectionIndex(currentSectionIndex - 1);
      setError('');
    }
  };

  const handleSubmit = async () => {
    if (!validateCurrentSection()) return;

    setSubmitting(true);
    setError('');

    try {
      // Prepare answer items
      const items = Object.entries(answers).map(([questionId, answer]) => {
        const question = sections
          .flatMap(s => s.questions)
          .find(q => q.id === parseInt(questionId));
        
        return {
          section_id: question?.section_id || 0,
          question_id: parseInt(questionId),
          answer: answer,
        };
      });

      const response = await fetch('/api/public-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aadhar_id: parseInt(aadharId || '0'),
          items: items,
        }),
      });

      const data = await response.json();

      if (data.ok) {
        setSuccess(true);
        setTimeout(() => {
          router.push('/public-form?success=true');
        }, 3000);
      } else {
        setError(data.error || 'फॉर्म सबमिट करताना त्रुटी आली');
      }
    } catch (err: any) {
      setError('फॉर्म सबमिट करताना त्रुटी आली: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="gradient-bg min-vh-100 d-flex align-items-center justify-content-center">
        <div className="text-center text-white">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">लोड होत आहे...</span>
          </div>
          <p className="mt-3">प्रश्न लोड करत आहे...</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="gradient-bg min-vh-100 d-flex align-items-center justify-content-center">
        <div className="card shadow-lg" style={{ maxWidth: '600px' }}>
          <div className="card-body text-center p-5">
            <div className="mb-4">
              <i className="bi bi-check-circle-fill text-success" style={{ fontSize: '4rem' }}></i>
            </div>
            <h2 className="text-success mb-3">फॉर्म यशस्वीरित्या सबमिट झाला!</h2>
            <p className="text-muted">आपला सर्वेक्षण फॉर्म यशस्वीरित्या जतन झाला आहे.</p>
          </div>
        </div>
      </div>
    );
  }

  const currentSection = sections[currentSectionIndex];
  const isLastSection = currentSectionIndex === sections.length - 1;

  return (
    <div className="gradient-bg min-vh-100 py-5">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-lg-10">
            <div className="card shadow-lg border-0">
              <div className="card-header bg-primary text-white py-3">
                <div className="d-flex justify-content-between align-items-center">
                  <h4 className="mb-0">सर्वेक्षण फॉर्म</h4>
                  <span className="badge bg-light text-dark">
                    विभाग {currentSectionIndex + 1} / {sections.length}
                  </span>
                </div>
              </div>
              <div className="card-body p-4">
                {error && (
                  <div className="alert alert-danger" role="alert">
                    {error}
                  </div>
                )}

                {fieldOfficer && (
                  <div className="alert alert-info d-flex align-items-center" role="alert">
                    <i className="bi bi-person-check me-2" style={{ fontSize: '1.5rem' }}></i>
                    <div>
                      <strong>संबंधित अधिकारी:</strong> {fieldOfficer.name}
                      {fieldOfficer.phone && (
                        <span className="ms-2">
                          <i className="bi bi-telephone me-1"></i>
                          {fieldOfficer.phone}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {currentSection && (
                  <>
                    <h5 className="mb-4">{currentSection.name}</h5>
                    
                    <div className="row g-3">
                      {currentSection.questions.map((question) => (
                        <div key={question.id} className="col-12">
                          <label className="form-label fw-bold">
                            {question.question}
                            {question.is_required === 1 && (
                              <span className="text-danger ms-1">*</span>
                            )}
                          </label>

                          {question.question_type.toLowerCase() === 'mcq' ? (
                            <div>
                              {question.options?.split(',').map((option, idx) => {
                                const opt = option.trim();
                                const answerKey = `${question.id}_${idx}`;
                                const isSelected = answers[question.id] === opt;
                                
                                return (
                                  <div key={idx} className="form-check mb-2">
                                    <input
                                      className="form-check-input"
                                      type={question.multi_select?.toLowerCase() === 'yes' ? 'checkbox' : 'radio'}
                                      name={`question_${question.id}`}
                                      id={answerKey}
                                      checked={isSelected}
                                      onChange={() => handleAnswerChange(question.id, opt)}
                                    />
                                    <label className="form-check-label" htmlFor={answerKey}>
                                      {opt}
                                    </label>
                                  </div>
                                );
                              })}
                            </div>
                          ) : question.question_type.toLowerCase() === 'date' ? (
                            <input
                              type="date"
                              className="form-control"
                              value={answers[question.id] || ''}
                              onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                              required={question.is_required === 1}
                            />
                          ) : (
                            <input
                              type="text"
                              className="form-control"
                              value={answers[question.id] || ''}
                              onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                              required={question.is_required === 1}
                            />
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="d-flex justify-content-between mt-4">
                      <button
                        className="btn btn-secondary"
                        onClick={handlePrev}
                        disabled={currentSectionIndex === 0}
                      >
                        <i className="bi bi-arrow-left me-2"></i>मागे
                      </button>
                      
                      {isLastSection ? (
                        <button
                          className="btn btn-success"
                          onClick={handleSubmit}
                          disabled={submitting}
                        >
                          {submitting ? (
                            <>
                              <span className="spinner-border spinner-border-sm me-2"></span>
                              सबमिट करत आहे...
                            </>
                          ) : (
                            <>
                              <i className="bi bi-check-circle me-2"></i>सबमिट करा
                            </>
                          )}
                        </button>
                      ) : (
                        <button
                          className="btn btn-primary"
                          onClick={handleNext}
                        >
                          पुढे <i className="bi bi-arrow-right ms-2"></i>
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PublicSurveyFormPage() {
  return (
    <Suspense fallback={
      <div className="gradient-bg min-vh-100 d-flex align-items-center justify-content-center">
        <div className="text-center text-white">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">लोड होत आहे...</span>
          </div>
        </div>
      </div>
    }>
      <PublicSurveyFormContent />
    </Suspense>
  );
}

