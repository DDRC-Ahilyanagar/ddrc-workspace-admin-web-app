'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useParams } from 'next/navigation';
import AdminLayout from '@/components/AdminLayout';
import { getAbsoluteImageUrl } from '@/lib/config';

interface Survey {
  id: number;
  aadhar_no: string;
  user_id: number;
  user_name: string | null;
  user_phone: string | null;
  front_image: string | null;
  back_image: string | null;
  holder_name: string | null;
  address_text: string | null;
  pincode: string | null;
  taluka: string | null;
  district: string | null;
  gender: string | null;
  dob: string | null;
  status: string;
  answer_count: number;
  created_at: string;
  updated_at: string;
  verification_status?: string | null;
  assigned_to?: number | null;
  verified_by?: number | null;
  verified_at?: string | null;
  admin_corrections?: string | null;
  source?: string | null;
}

interface Answer {
  id: number;
  question_id: number;
  section_id: number;
  answer: string;
  created_at: string;
  updated_at: string;
  question_marathi: string | null;
  question_english: string | null;
  question_type: string | null;
  options: string | null;
  section_name: string | null;
}

interface EditingAnswer {
  question_id: number;
  value: string;
  type: string;
  options?: string;
}

function SurveyDetailsContent() {
  const router = useRouter();
  const params = useParams();
  const surveyId = params?.id ? parseInt(params.id as string) : 0;

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [answersBySection, setAnswersBySection] = useState<Record<string, Answer[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState<'xlsx' | 'pdf' | null>(null);
  const [userType, setUserType] = useState<string>('');
  const [markingVerified, setMarkingVerified] = useState(false);
  const [markingRejected, setMarkingRejected] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [editingAnswer, setEditingAnswer] = useState<EditingAnswer | null>(null);
  const [updatingAnswer, setUpdatingAnswer] = useState(false);
  const [clarifications, setClarifications] = useState<Record<number, { reason: string; status: string }>>({});
  const [showClarificationModal, setShowClarificationModal] = useState(false);
  const [selectedQuestions, setSelectedQuestions] = useState<Record<number, string>>({});
  const [sendingClarification, setSendingClarification] = useState(false);
  const [publicQuestionIds, setPublicQuestionIds] = useState<Set<number>>(new Set());
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showLightbox, setShowLightbox] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Get user type from localStorage
    const storedUserType = typeof window !== 'undefined' ? localStorage.getItem('user_type') || '' : '';
    setUserType(storedUserType);
    // Debug log
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      console.log('User type from localStorage:', storedUserType);
    }
  }, []);

  useEffect(() => {
    if (!surveyId || surveyId <= 0) {
      setError('Invalid survey ID');
      setLoading(false);
      return;
    }

    const loadSurveyDetails = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/admin/surveys/${surveyId}`, {
          cache: 'no-store',
        });
        const json = await res.json();
        if (json.ok && json.data) {
          const s = json.data.survey;
          setSurvey(s);

          let sectionData = json.data.answersBySection || {};
          let allAnswers = json.data.answers || [];

          setAnswers(allAnswers);
          setAnswersBySection(sectionData);
        } else {
          setError(json.error || 'Survey not found');
        }
      } catch (err: any) {
        setError('Failed to load survey details');
      } finally {
        setLoading(false);
      }
    };

    const loadClarifications = async () => {
      try {
        const res = await fetch(`/api/admin/surveys/${surveyId}/request-clarification`, {
          cache: 'no-store',
        });
        const json = await res.json();
        if (json.ok && Array.isArray(json.clarifications)) {
          const clarMap: Record<number, { reason: string; status: string }> = {};
          json.clarifications.forEach((c: any) => {
            clarMap[c.question_id] = { reason: c.reason, status: c.status };
          });
          setClarifications(clarMap);
        }
      } catch (err) {
        console.error('Failed to load clarifications', err);
      }
    };

    loadSurveyDetails();
    loadClarifications();
  }, [surveyId]);

  // Normalize image path/URL for display
  const normalizeImagePath = (path: string): string => {
    if (!path) return path;
    // Use the utility function to get absolute URL
    return getAbsoluteImageUrl(path);
  };

  const formatAnswer = (answer: Answer): string => {
    if (!answer.answer) return '-';

    // If it's an array (for multi-select), join it
    try {
      const parsed = JSON.parse(answer.answer);
      if (Array.isArray(parsed)) {
        return parsed.join(', ');
      }
    } catch { }

    // Check if it's actually an image path
    const answerStr = answer.answer.trim();

    // We don't normalize here anymore, we'll do it in the rendering logic 
    // to handle multi-image answers correctly.
    return answerStr;
  };

  const isImageAnswer = (answer: string): boolean => {
    if (!answer) return false;

    const answerStr = answer.trim();

    // Only treat as image if it clearly looks like an image path/URL
    return (
      answerStr.includes('uploads') ||
      answerStr.startsWith('/uploads') ||
      answerStr.startsWith('uploads/') ||
      answerStr.match(/\.(jpg|jpeg|png|gif|webp|pdf)$/i) !== null ||
      (answerStr.match(/^[a-f0-9-]{36}$/i) !== null) || // UUID format (likely image filename)
      (answerStr.startsWith('http://') || answerStr.startsWith('https://')) &&
      (answerStr.includes('.jpg') || answerStr.includes('.jpeg') ||
        answerStr.includes('.png') || answerStr.includes('.gif') ||
        answerStr.includes('.webp') || answerStr.includes('.pdf') ||
        answerStr.includes('uploads'))
    );
  };

  const handleExport = async (format: 'xlsx' | 'pdf') => {
    if (!surveyId || surveyId <= 0) return;
    setExporting(format);
    try {
      const res = await fetch(`/api/admin/surveys/${surveyId}/export?format=${format}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `survey_${surveyId}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export survey', err);
      alert('फाइल डाउनलोड होत नाही. कृपया पुन्हा प्रयत्न करा.');
    } finally {
      setExporting(null);
    }
  };

  const handleMarkVerified = async () => {
    if (!surveyId || surveyId <= 0) return;

    const confirmMessage = 'तुम्हाला खात्री आहे की तुम्ही हे सर्वेक्षण पडताळलेले म्हणून चिन्हांकित करू इच्छिता?';
    if (!confirm(confirmMessage)) return;

    setMarkingVerified(true);
    try {
      const res = await fetch(`/api/admin/surveys/${surveyId}/mark-verified`, {
        method: 'POST',
        cache: 'no-store',
        credentials: 'include',
      });
      const json = await res.json();

      if (json.ok) {
        alert('सर्वेक्षण यशस्वीरित्या पडताळलेले म्हणून चिन्हांकित केले गेले.');
        // Reload survey details
        const res2 = await fetch(`/api/admin/surveys/${surveyId}`, {
          cache: 'no-store',
        });
        const json2 = await res2.json();
        if (json2.ok && json2.data) {
          setSurvey(json2.data.survey);
        }
      } else {
        alert(json.error || 'सर्वेक्षण पडताळण्यात अयशस्वी. कृपया पुन्हा प्रयत्न करा.');
      }
    } catch (err) {
      console.error('Failed to mark survey as verified', err);
      alert('सर्वेक्षण पडताळण्यात अयशस्वी. कृपया पुन्हा प्रयत्न करा.');
    } finally {
      setMarkingVerified(false);
    }
  };

  const handleMarkRejected = async () => {
    if (!surveyId || surveyId <= 0) return;

    if (!rejectionReason.trim()) {
      alert('कृपया नाकारण्याचे कारण प्रविष्ट करा.');
      return;
    }

    const confirmMessage = 'तुम्हाला खात्री आहे की तुम्ही हे सर्वेक्षण नाकारू इच्छिता?';
    if (!confirm(confirmMessage)) return;

    setMarkingRejected(true);
    try {
      const res = await fetch(`/api/admin/surveys/${surveyId}/mark-rejected`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
        credentials: 'include',
        body: JSON.stringify({ reason: rejectionReason }),
      });
      const json = await res.json();

      if (json.ok) {
        alert('सर्वेक्षण यशस्वीरित्या नाकारले गेले.');
        setShowRejectModal(false);
        setRejectionReason('');
        // Reload survey details
        const res2 = await fetch(`/api/admin/surveys/${surveyId}`, {
          cache: 'no-store',
        });
        const json2 = await res2.json();
        if (json2.ok && json2.data) {
          setSurvey(json2.data.survey);
        }
      } else {
        alert(json.error || 'सर्वेक्षण नाकारण्यात अयशस्वी. कृपया पुन्हा प्रयत्न करा.');
      }
    } catch (err) {
      console.error('Failed to mark survey as rejected', err);
      alert('सर्वेक्षण नाकारण्यात अयशस्वी. कृपया पुन्हा प्रयत्न करा.');
    } finally {
      setMarkingRejected(false);
    }
  };

  const handleRequestClarification = async () => {
    if (!surveyId || surveyId <= 0) return;

    const questions = Object.entries(selectedQuestions)
      .filter(([_, reason]) => reason && reason.trim())
      .map(([questionId, reason]) => ({
        question_id: parseInt(questionId),
        reason: reason.trim(),
      }));

    if (questions.length === 0) {
      alert('कृपया किमान एक प्रश्न निवडा आणि कारण प्रविष्ट करा.');
      return;
    }

    setSendingClarification(true);
    try {
      const res = await fetch(`/api/admin/surveys/${surveyId}/request-clarification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
        credentials: 'include',
        body: JSON.stringify({ questions }),
      });
      const json = await res.json();

      if (json.ok) {
        alert(`स्पष्टीकरण विनंती यशस्वीरित्या पाठवल्या गेल्या (${questions.length} प्रश्न).`);
        setShowClarificationModal(false);
        setSelectedQuestions({});
        // Reload clarifications
        const res2 = await fetch(`/api/admin/surveys/${surveyId}/request-clarification`, {
          cache: 'no-store',
        });
        const json2 = await res2.json();
        if (json2.ok && Array.isArray(json2.clarifications)) {
          const clarMap: Record<number, { reason: string; status: string }> = {};
          json2.clarifications.forEach((c: any) => {
            clarMap[c.question_id] = { reason: c.reason, status: c.status };
          });
          setClarifications(clarMap);
        }
      } else {
        alert(json.error || 'स्पष्टीकरण विनंती पाठवण्यात अयशस्वी. कृपया पुन्हा प्रयत्न करा.');
      }
    } catch (err) {
      console.error('Failed to request clarification', err);
      alert('स्पष्टीकरण विनंती पाठवण्यात अयशस्वी. कृपया पुन्हा प्रयत्न करा.');
    } finally {
      setSendingClarification(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="container-fluid py-4">
          <div className="text-center">
            <div className="spinner-border" role="status">
              <span className="visually-hidden">लोड होत आहे...</span>
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error || !survey) {
    return (
      <AdminLayout>
        <div className="container-fluid py-4">
          <div className="alert alert-danger" role="alert">
            {error || 'Survey not found'}
          </div>
          <button
            className="btn btn-secondary"
            onClick={() => router.push('/survekshan')}
          >
            मागे जा
          </button>
        </div>
      </AdminLayout>
    );
  }

  // Sort sections by section_id if available, otherwise by name
  const sections = Object.keys(answersBySection).sort((a, b) => {
    const aAnswers = answersBySection[a];
    const bAnswers = answersBySection[b];
    const aId = aAnswers[0]?.section_id || 0;
    const bId = bAnswers[0]?.section_id || 0;
    if (aId !== bId) return aId - bId;
    return a.localeCompare(b);
  });

  return (
    <AdminLayout>
      <div className="container-fluid py-4">
        <div className="d-flex justify-content-between align-items-center mb-4 flex-column flex-md-row gap-3">
          <h1 className="title mb-0">सर्वेक्षण तपशील</h1>
          <div className="d-flex flex-wrap gap-2">
            <button
              className="btn btn-outline-success"
              disabled={exporting !== null}
              onClick={() => handleExport('xlsx')}
            >
              {exporting === 'xlsx' ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                  एक्सेल डाउनलोड…
                </>
              ) : (
                <>
                  <i className="bi bi-file-earmark-excel me-2"></i>
                  Excel मध्ये निर्यात करा
                </>
              )}
            </button>
            <button
              className="btn btn-outline-danger"
              disabled={exporting !== null}
              onClick={() => handleExport('pdf')}
            >
              {exporting === 'pdf' ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                  PDF डाउनलोड…
                </>
              ) : (
                <>
                  <i className="bi bi-file-earmark-pdf me-2"></i>
                  PDF मध्ये निर्यात करा
                </>
              )}
            </button>
            {(userType || '').toLowerCase() === 'verification_officer' &&
              survey?.verification_status !== 'verified' &&
              survey?.verification_status !== 'rejected' &&
              survey?.assigned_to && (
                <>
                  <button
                    className="btn btn-warning"
                    disabled={markingVerified || markingRejected || sendingClarification}
                    onClick={() => setShowClarificationModal(true)}
                  >
                    <i className="bi bi-question-circle me-2"></i>
                    स्पष्टीकरण विनंती करा
                  </button>
                  <button
                    className="btn btn-success"
                    disabled={markingVerified || markingRejected}
                    onClick={handleMarkVerified}
                  >
                    {markingVerified ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                        पडताळत आहे...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check-circle me-2"></i>
                        पडताळलेले म्हणून चिन्हांकित करा
                      </>
                    )}
                  </button>
                  <button
                    className="btn btn-danger"
                    disabled={markingVerified || markingRejected}
                    onClick={() => setShowRejectModal(true)}
                  >
                    <i className="bi bi-x-circle me-2"></i>
                    नाकारा
                  </button>
                </>
              )}
            <button
              className="btn btn-secondary"
              onClick={() => router.push('/survekshan')}
            >
              <i className="bi bi-arrow-left me-2"></i>मागे जा
            </button>
          </div>
        </div>

        {/* Survey Basic Info */}
        <div className="card shadow-sm mb-4 animate__animated animate__fadeInUp">
          <div className="card-header bg-primary text-white">
            <h5 className="mb-0">मूलभूत माहिती</h5>
          </div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-6">
                <strong>सर्वेक्षण ID:</strong> {survey.id}
              </div>
              <div className="col-md-6">
                <strong>आधार क्रमांक:</strong> {survey.aadhar_no || '-'}
              </div>
              <div className="col-md-6">
                <strong>धारकाचे नाव:</strong> {survey.holder_name || '-'}
              </div>
              <div className="col-md-6">
                <strong>लिंग:</strong> {survey.gender || '-'}
              </div>
              <div className="col-md-6">
                <strong>जन्मतारीख:</strong> {survey.dob || '-'}
              </div>
              <div className="col-md-6">
                <strong>स्थिती:</strong>{' '}
                <span
                  className={`badge ${survey.status === 'Completed' ? 'bg-success' : 'bg-warning'
                    }`}
                >
                  {survey.status === 'Completed' ? 'पूर्ण' : 'प्रलंबित'}
                </span>
              </div>
              {survey.source !== 'Divyang Self' && (
                <div className="col-md-6">
                  <strong>वापरकर्ता / स्त्रोत:</strong>{' '}
                  {survey.source === 'Public Form' ? (
                    <span className="badge bg-info text-dark">नागरिकाकडून थेट अर्ज (Citizen)</span>
                  ) : (
                    <>
                      {survey.user_name || `ID: ${survey.user_id}`}
                      {survey.user_phone && ` (${survey.user_phone})`}
                    </>
                  )}
                </div>
              )}
              <div className="col-md-6">
                <strong>उत्तरांची संख्या:</strong> {survey.answer_count}
              </div>
              {survey.assigned_to && (
                <div className="col-md-6">
                  <strong>नियुक्त पडताळणी अधिकारी:</strong>{' '}
                  <span className="badge bg-primary">ID: {survey.assigned_to}</span>
                </div>
              )}
              {survey.address_text && (
                <div className="col-12">
                  <strong>पत्ता:</strong> {survey.address_text}
                  {survey.pincode && ` - ${survey.pincode}`}
                </div>
              )}
              {survey.taluka && (
                <div className="col-md-6">
                  <strong>तालुका:</strong> {survey.taluka}
                </div>
              )}
              {survey.district && (
                <div className="col-md-6">
                  <strong>जिल्हा:</strong> {survey.district}
                </div>
              )}
              <div className="col-md-6">
                <strong>तयार केले:</strong>{' '}
                {new Date(survey.created_at).toLocaleString('mr-IN')}
              </div>
              <div className="col-md-6">
                <strong>अपडेट केले:</strong>{' '}
                {new Date(survey.updated_at).toLocaleString('mr-IN')}
              </div>
              {survey.source && survey.source !== 'Divyang Self' && (
                <div className="col-12">
                  <strong>स्त्रोत (Source):</strong> <span className="badge bg-info text-dark">{survey.source}</span>
                </div>
              )}
            </div>

            {/* Aadhaar Images */}
            {(survey.front_image || survey.back_image) && (
              <div className="row g-3 mt-3">
                {survey.front_image && (
                  <div className="col-md-6">
                    <strong>आधार समोरील:</strong>
                    <div className="mt-2">
                      {(() => {
                        const originalPath = survey.front_image;
                        const absUrl = getAbsoluteImageUrl(originalPath);
                        return absUrl ? (
                          <div
                            onClick={() => {
                              setSelectedImage(absUrl);
                              setShowLightbox(true);
                            }}
                          >
                            <img
                              src={absUrl}
                              alt="Aadhaar Front"
                              className="img-fluid border rounded"
                              style={{ maxHeight: '300px', cursor: 'pointer' }}
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                                const parent = (e.target as HTMLImageElement).parentElement;
                                if (parent) {
                                  parent.innerHTML = `<span class="badge bg-warning">Image not found: ${originalPath}</span>`;
                                }
                              }}
                            />
                          </div>
                        ) : (
                          <span className="badge bg-secondary">{originalPath || '-'}</span>
                        );
                      })()}
                    </div>
                  </div>
                )}
                {survey.back_image && (
                  <div className="col-md-6">
                    <strong>आधार मागील:</strong>
                    <div className="mt-2">
                      {(() => {
                        const originalPath = survey.back_image;
                        const absUrl = getAbsoluteImageUrl(originalPath);
                        return absUrl ? (
                          <div
                            onClick={() => {
                              setSelectedImage(absUrl);
                              setShowLightbox(true);
                            }}
                          >
                            <img
                              src={absUrl}
                              alt="Aadhaar Back"
                              className="img-fluid border rounded"
                              style={{ maxHeight: '300px', cursor: 'pointer' }}
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                                const parent = (e.target as HTMLImageElement).parentElement;
                                if (parent) {
                                  parent.innerHTML = `<span class="badge bg-warning">Image not found: ${originalPath}</span>`;
                                }
                              }}
                            />
                          </div>
                        ) : (
                          <span className="badge bg-secondary">{originalPath || '-'}</span>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Answers by Section */}
        {sections.length > 0 ? (
          sections.map((sectionKey, idx) => {
            const sectionAnswers = answersBySection[sectionKey] || [];
            const sectionName =
              sectionAnswers[0]?.section_name || sectionKey || 'Unknown Section';
            return (
              <div
                key={sectionKey}
                className="card shadow-sm mb-4 animate__animated animate__fadeInUp"
                style={{ animationDelay: `${idx * 0.1}s` }}
              >
                <div className="card-header bg-secondary text-white">
                  <h5 className="mb-0">{sectionName}</h5>
                </div>
                <div className="card-body">
                  <div className="table-responsive">
                    <table className="table table-striped">
                      <thead>
                        <tr>
                          <th style={{ width: '5%' }}>ID</th>
                          <th style={{ width: '35%' }}>प्रश्न</th>
                          <th style={{ width: '50%' }}>उत्तर</th>
                          {(userType || '').toLowerCase() === 'verification_officer' &&
                            survey?.verification_status !== 'verified' &&
                            survey?.verification_status !== 'rejected' &&
                            survey?.assigned_to && (
                              <th style={{ width: '10%' }}>क्रिया</th>
                            )}
                        </tr>
                      </thead>
                      <tbody>
                        {sectionAnswers.map((ans, ansIdx) => {
                          const answerText = formatAnswer(ans);
                          const isImage = isImageAnswer(answerText);
                          const clarification = clarifications[ans.question_id];
                          const normalizedUserTypeForClarification = (userType || '').toLowerCase();
                          const canRequestClarification = normalizedUserTypeForClarification === 'verification_officer' &&
                            survey?.verification_status !== 'verified' &&
                            survey?.verification_status !== 'rejected' &&
                            survey?.assigned_to;
                          // Allow editing for verification officers if survey is not verified/rejected
                          // Backend will enforce assignment check
                          const normalizedUserType = (userType || '').toLowerCase();
                          const canEdit = normalizedUserType === 'verification_officer' &&
                            survey?.verification_status !== 'verified' &&
                            survey?.verification_status !== 'rejected' &&
                            !isImage;

                          // Create unique key combining section_id, question_id, and index to avoid duplicates
                          const uniqueKey = `${sectionKey}_${ans.section_id || 0}_${ans.question_id}_${ansIdx}`;

                          return (
                            <tr key={uniqueKey} className={clarification ? 'table-warning' : ''}>
                              <td>{ans.question_id}</td>
                              <td>
                                <strong>
                                  {ans.question_marathi || ans.question_english || `Question ${ans.question_id}`}
                                </strong>
                                {clarification && (
                                  <div className="mt-1">
                                    <span className="badge bg-warning text-dark">
                                      <i className="bi bi-exclamation-triangle me-1"></i>
                                      स्पष्टीकरण आवश्यक ({clarification.status === 'pending' ? 'प्रलंबित' : 'निराकरण'})
                                    </span>
                                    <div className="small text-muted mt-1">
                                      <strong>कारण:</strong> {clarification.reason}
                                    </div>
                                  </div>
                                )}
                              </td>
                              <td>
                                {editingAnswer?.question_id === ans.question_id ? (
                                  <div className="d-flex align-items-center gap-2">
                                    {ans.question_type === 'dropdown' && ans.options ? (
                                      <select
                                        className="form-control form-control-sm"
                                        value={editingAnswer.value}
                                        onChange={(e) => setEditingAnswer({ ...editingAnswer, value: e.target.value })}
                                        disabled={updatingAnswer}
                                        style={{ minWidth: '200px' }}
                                      >
                                        <option value="">-- निवडा --</option>
                                        {ans.options.split(',').map((opt: string, idx: number) => (
                                          <option key={idx} value={opt.trim()}>
                                            {opt.trim()}
                                          </option>
                                        ))}
                                      </select>
                                    ) : ans.question_type === 'date' ? (
                                      <input
                                        type="date"
                                        className="form-control form-control-sm"
                                        value={editingAnswer.value}
                                        onChange={(e) => setEditingAnswer({ ...editingAnswer, value: e.target.value })}
                                        disabled={updatingAnswer}
                                        style={{ minWidth: '200px' }}
                                      />
                                    ) : (
                                      <input
                                        type="text"
                                        className="form-control form-control-sm"
                                        value={editingAnswer.value}
                                        onChange={(e) => setEditingAnswer({ ...editingAnswer, value: e.target.value })}
                                        disabled={updatingAnswer}
                                        style={{ minWidth: '300px' }}
                                      />
                                    )}
                                    <button
                                      className="btn btn-sm btn-success"
                                      onClick={async () => {
                                        if (!editingAnswer) return;
                                        setUpdatingAnswer(true);
                                        try {
                                          const res = await fetch(`/api/admin/surveys/${surveyId}/update-answer`, {
                                            method: 'PUT',
                                            headers: {
                                              'Content-Type': 'application/json',
                                            },
                                            cache: 'no-store',
                                            credentials: 'include',
                                            body: JSON.stringify({
                                              question_id: ans.question_id,
                                              answer: editingAnswer.value,
                                            }),
                                          });
                                          const json = await res.json();

                                          if (json.ok) {
                                            // Reload survey details
                                            const res2 = await fetch(`/api/admin/surveys/${surveyId}`, {
                                              cache: 'no-store',
                                            });
                                            const json2 = await res2.json();
                                            if (json2.ok && json2.data) {
                                              setSurvey(json2.data.survey);
                                              setAnswers(json2.data.answers || []);
                                              setAnswersBySection(json2.data.answersBySection || {});
                                            }
                                            setEditingAnswer(null);
                                            alert('उत्तर यशस्वीरित्या अपडेट केले गेले.');
                                          } else {
                                            alert(json.error || 'उत्तर अपडेट करण्यात अयशस्वी. कृपया पुन्हा प्रयत्न करा.');
                                          }
                                        } catch (err) {
                                          console.error('Failed to update answer', err);
                                          alert('उत्तर अपडेट करण्यात अयशस्वी. कृपया पुन्हा प्रयत्न करा.');
                                        } finally {
                                          setUpdatingAnswer(false);
                                        }
                                      }}
                                      disabled={updatingAnswer}
                                      title="सेव्ह करा"
                                    >
                                      <i className="bi bi-check"></i>
                                    </button>
                                    <button
                                      className="btn btn-sm btn-warning"
                                      onClick={() => {
                                        // Cancel editing and open clarification modal with this question
                                        setEditingAnswer(null);
                                        setSelectedQuestions({
                                          ...selectedQuestions,
                                          [ans.question_id]: clarification?.reason || '',
                                        });
                                        setShowClarificationModal(true);
                                      }}
                                      disabled={updatingAnswer}
                                      title="फील्ड ऑफिसरला पाठवा"
                                    >
                                      <i className="bi bi-send"></i>
                                    </button>
                                    <button
                                      className="btn btn-sm btn-secondary"
                                      onClick={() => setEditingAnswer(null)}
                                      disabled={updatingAnswer}
                                      title="रद्द करा"
                                    >
                                      <i className="bi bi-x"></i>
                                    </button>
                                  </div>
                                ) : (
                                  <div className="d-flex align-items-center justify-content-between">
                                    <div>
                                      {isImage ? (
                                        <div className="d-flex flex-wrap gap-2">
                                          {(answerText || '').split(',').map((part: string, i: number) => {
                                            const item = part.trim();
                                            if (!item) return null;
                                            const absUrl = getAbsoluteImageUrl(item);
                                            return (
                                              <div
                                                key={i}
                                                onClick={() => {
                                                  setSelectedImage(absUrl);
                                                  setShowLightbox(true);
                                                }}
                                              >
                                                <img
                                                  src={absUrl}
                                                  alt={`Answer ${i}`}
                                                  className="img-thumbnail"
                                                  style={{ height: '100px', cursor: 'pointer' }}
                                                  onError={(e) => {
                                                    (e.target as HTMLImageElement).style.display = 'none';
                                                    if (i === 0) { // Only show error for first image to avoid clutter
                                                      const parent = (e.target as HTMLImageElement).parentElement?.parentElement;
                                                      if (parent && !parent.querySelector('.badge-error')) {
                                                        const span = document.createElement('span');
                                                        span.className = 'badge bg-warning badge-error';
                                                        span.innerText = `Image not found: ${item}`;
                                                        parent.appendChild(span);
                                                      }
                                                    }
                                                  }}
                                                />
                                              </div>
                                            );
                                          })}
                                        </div>
                                      ) : (
                                        <span className={answerText === 'Not Answered' ? 'text-danger fw-bold' : ''}>
                                          {answerText || '-'}
                                        </span>
                                      )}
                                    </div>
                                    {canEdit && (
                                      <button
                                        className="btn btn-sm btn-outline-primary ms-2"
                                        onClick={() => {
                                          setEditingAnswer({
                                            question_id: ans.question_id,
                                            value: ans.answer || '',
                                            type: ans.question_type || 'text',
                                            options: ans.options || undefined,
                                          });
                                        }}
                                        title="संपादन करा"
                                      >
                                        <i className="bi bi-pencil"></i>
                                      </button>
                                    )}
                                  </div>
                                )}
                              </td>
                              {canRequestClarification && (
                                <td>
                                  <button
                                    className="btn btn-sm btn-outline-warning"
                                    onClick={() => {
                                      setSelectedQuestions({
                                        ...selectedQuestions,
                                        [ans.question_id]: clarification?.reason || '',
                                      });
                                      setShowClarificationModal(true);
                                    }}
                                    title="स्पष्टीकरण विनंती करा"
                                  >
                                    <i className="bi bi-question-circle"></i>
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="card shadow-sm mb-4">
            <div className="card-body text-center text-muted">
              <p className="mb-0">कोणतेही उत्तरे उपलब्ध नाहीत</p>
            </div>
          </div>
        )}

        {/* Clarification Request Modal */}
        {showClarificationModal && typeof document !== 'undefined' && createPortal(
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '100%', maxWidth: '900px' }}>
              <div className="card shadow-lg border-0 rounded-4 overflow-hidden animate__animated animate__zoomIn animate__faster">
                <div className="card-header bg-dark text-white d-flex justify-content-between align-items-center py-3 px-4">
                  <h5 className="mb-0 fw-bold d-flex align-items-center gap-2">
                    <i className="bi bi-question-circle-fill text-warning"></i>
                    स्पष्टीकरण विनंती (Clarification Request)
                  </h5>
                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    onClick={() => {
                      setShowClarificationModal(false);
                      setSelectedQuestions({});
                    }}
                    disabled={sendingClarification}
                  ></button>
                </div>
                <div className="card-body p-4">
                  <p className="text-muted mb-4">
                    कृपया स्पष्टीकरण आवश्यक असलेले प्रश्न निवडा आणि प्रत्येक प्रश्नासाठी कारण प्रविष्ट करा.
                  </p>

                  <div className="input-group mb-4 shadow-sm">
                    <span className="input-group-text bg-white border-end-0">
                      <i className="bi bi-search text-muted"></i>
                    </span>
                    <input
                      type="text"
                      className="form-control border-start-0 ps-0"
                      placeholder="प्रश्न शोधा (Search Questions)..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>

                  {Object.keys(selectedQuestions).length > 0 && (
                    <div className="alert alert-info d-flex align-items-center mb-4 rounded-3 shadow-sm border-info-subtle">
                      <i className="bi bi-info-circle-fill text-info me-3 fs-5"></i>
                      <div>
                        <strong>{Object.keys(selectedQuestions).length}</strong> प्रश्न निवडले आहेत.
                      </div>
                    </div>
                  )}
                  <div className="table-responsive border rounded-3 shadow-sm" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    <table className="table table-hover mb-0">
                      <thead className="table-light sticky-top">
                        <tr>
                          <th className="py-3 ps-3" style={{ width: '5%' }}>ID</th>
                          <th className="py-3" style={{ width: '30%' }}>प्रश्न (Question)</th>
                          <th className="py-3" style={{ width: '25%' }}>सध्याचे उत्तर (Current Answer)</th>
                          <th className="py-3 pe-3" style={{ width: '40%' }}>कारण (Reason)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {answers.filter(ans => {
                          if (!searchTerm) return true;
                          const term = searchTerm.toLowerCase();
                          return (
                            (ans.question_marathi && ans.question_marathi.toLowerCase().includes(term)) ||
                            (ans.question_english && ans.question_english.toLowerCase().includes(term)) ||
                            ans.question_id.toString().includes(term) ||
                            (ans.answer && ans.answer.toLowerCase().includes(term))
                          );
                        }).map((ans, ansIdx) => {
                          const questionKey = ans.question_id;
                          const isSelected = selectedQuestions.hasOwnProperty(questionKey);

                          // Create unique key combining section_id, question_id, and index to avoid duplicates
                          const uniqueKey = `clarification_${ans.section_id || 0}_${ans.question_id}_${ansIdx}`;

                          return (
                            <tr key={uniqueKey} className={isSelected ? 'table-warning' : ''}>
                              <td className="ps-3 align-middle">
                                <div className="form-check">
                                  <input
                                    className="form-check-input"
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedQuestions({
                                          ...selectedQuestions,
                                          [questionKey]: clarifications[questionKey]?.reason || '',
                                        });
                                      } else {
                                        const newSelected = { ...selectedQuestions };
                                        delete newSelected[questionKey];
                                        setSelectedQuestions(newSelected);
                                      }
                                    }}
                                    disabled={sendingClarification}
                                    style={{ cursor: 'pointer' }}
                                  />
                                </div>
                              </td>
                              <td className="align-middle">
                                <span className="fw-medium text-dark">
                                  {ans.question_marathi || ans.question_english || `Question ${ans.question_id}`}
                                </span>
                              </td>
                              <td className="align-middle">
                                <div className="text-secondary small text-break" style={{ maxHeight: '80px', overflowY: 'auto' }}>
                                  {ans.answer ? (
                                    ans.answer
                                  ) : (
                                    <span className="fst-italic text-muted">-</span>
                                  )}
                                </div>
                              </td>
                              <td className="pe-3 py-2">
                                {isSelected ? (
                                  <textarea
                                    className="form-control form-control-sm shadow-none border-warning"
                                    rows={2}
                                    value={selectedQuestions[questionKey] || ''}
                                    onChange={(e) => {
                                      setSelectedQuestions({
                                        ...selectedQuestions,
                                        [questionKey]: e.target.value,
                                      });
                                    }}
                                    placeholder="स्पष्टीकरण आवश्यक असल्याचे कारण प्रविष्ट करा..."
                                    disabled={sendingClarification}
                                    autoFocus
                                  />
                                ) : (
                                  <span className="text-muted small fst-italic">-</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="card-footer bg-light p-3 border-top">
                  <div className="d-flex justify-content-between align-items-center w-100">
                    <div>
                      {Object.keys(selectedQuestions).length > 0 ? (
                        <span className="text-success fw-bold animate__animated animate__fadeIn">
                          <i className="bi bi-check-circle-fill me-2"></i>
                          {Object.keys(selectedQuestions).length} प्रश्न निवडले
                        </span>
                      ) : (
                        <span className="text-muted small">
                          <i className="bi bi-exclamation-circle me-1"></i>
                          कृपया किमान एक प्रश्न निवडा
                        </span>
                      )}
                    </div>
                    <div className="d-flex gap-2">
                      <button
                        type="button"
                        className="btn btn-outline-secondary px-4 fw-medium"
                        onClick={() => {
                          setShowClarificationModal(false);
                          setSelectedQuestions({});
                        }}
                        disabled={sendingClarification}
                      >
                        रद्द करा
                      </button>
                      <button
                        type="button"
                        className="btn btn-warning px-4 fw-bold shadow-sm d-flex align-items-center gap-2"
                        onClick={handleRequestClarification}
                        disabled={sendingClarification || Object.keys(selectedQuestions).length === 0}
                      >
                        {sendingClarification ? (
                          <>
                            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                            <span>पाठवत आहे...</span>
                          </>
                        ) : (
                          <>
                            <i className="bi bi-send-fill"></i>
                            <span>विनंती पाठवा</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Reject Modal */}
        {showRejectModal && typeof document !== 'undefined' && createPortal(
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '100%', maxWidth: '500px' }}>
              <div className="card shadow-lg border-0 rounded-4 overflow-hidden animate__animated animate__zoomIn animate__faster">
                <div className="card-header bg-danger text-white d-flex justify-content-between align-items-center py-3 px-4">
                  <h5 className="mb-0 fw-bold d-flex align-items-center gap-2">
                    <i className="bi bi-x-circle-fill text-white-50"></i>
                    सर्वेक्षण नाकारा (Reject Survey)
                  </h5>
                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    onClick={() => {
                      setShowRejectModal(false);
                      setRejectionReason('');
                    }}
                    disabled={markingRejected}
                  ></button>
                </div>
                <div className="card-body p-4">
                  <div className="mb-0">
                    <label htmlFor="rejectionReason" className="form-label fw-bold text-dark mb-2">
                      नाकारण्याचे कारण (Reason for Rejection):
                    </label>
                    <textarea
                      id="rejectionReason"
                      className="form-control form-control-lg shadow-sm border-secondary-subtle"
                      rows={4}
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="कृपया सर्वेक्षण नाकारण्याचे कारण सविस्तर लिहा..."
                      disabled={markingRejected}
                      autoFocus
                    />
                    <div className="form-text text-muted mt-2">
                      <i className="bi bi-info-circle me-1"></i>
                      हे कारण फील्ड ऑफिसरला दुरुस्तीसाठी पाठवले जाईल.
                    </div>
                  </div>
                </div>
                <div className="card-footer bg-light p-3 border-top d-flex justify-content-end gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-secondary px-4 fw-medium"
                    onClick={() => {
                      setShowRejectModal(false);
                      setRejectionReason('');
                    }}
                    disabled={markingRejected}
                  >
                    रद्द करा
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger px-4 fw-bold shadow-sm d-flex align-items-center gap-2"
                    onClick={handleMarkRejected}
                    disabled={markingRejected || !rejectionReason.trim()}
                  >
                    {markingRejected ? (
                      <>
                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                        <span>नाकारत आहे...</span>
                      </>
                    ) : (
                      <>
                        <i className="bi bi-x-circle-fill"></i>
                        <span>नाकारा (Reject)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
        {/* Rejection Modal and other modals ... */}

        {/* Lightbox Modal */}
        {showLightbox && selectedImage && (
          <div
            className="modal show d-block animate__animated animate__fadeIn"
            tabIndex={-1}
            style={{
              backgroundColor: 'rgba(0,0,0,0.9)',
              zIndex: 1060,
              padding: 0
            }}
            onClick={() => setShowLightbox(false)}
          >
            <div
              className="d-flex align-items-center justify-content-center w-100 h-100"
              style={{ position: 'relative' }}
            >
              <button
                className="btn btn-dark btn-lg"
                style={{
                  position: 'absolute',
                  top: '20px',
                  right: '20px',
                  borderRadius: '50%',
                  width: '50px',
                  height: '50px',
                  zIndex: 1061,
                  border: '2px solid rgba(255,255,255,0.3)'
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowLightbox(false);
                }}
              >
                <i className="bi bi-x-lg text-white"></i>
              </button>
              <div
                className="p-3"
                style={{ maxWidth: '95vw', maxHeight: '95vh' }}
                onClick={(e) => e.stopPropagation()}
              >
                <img
                  src={selectedImage}
                  alt="Lightbox Content"
                  className="img-fluid shadow-lg rounded animate__animated animate__zoomIn animate__faster"
                  style={{
                    maxHeight: '90vh',
                    boxShadow: '0 0 50px rgba(0,0,0,0.5)',
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

export default function SurveyDetailsPage() {
  return (
    <Suspense
      fallback={
        <AdminLayout>
          <div className="container-fluid py-4">
            <div className="text-center">
              <div className="spinner-border" role="status">
                <span className="visually-hidden">लोड होत आहे...</span>
              </div>
            </div>
          </div>
        </AdminLayout>
      }
    >
      <SurveyDetailsContent />
    </Suspense>
  );
}

