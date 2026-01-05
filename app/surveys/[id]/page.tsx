'use client';

import { useEffect, useState, Suspense } from 'react';
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
          setSurvey(json.data.survey);
          setAnswers(json.data.answers || []);
          setAnswersBySection(json.data.answersBySection || {});
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
    
    // If it's an image URL, normalize and return it
    const normalized = normalizeImagePath(answer.answer);
    if (normalized.startsWith('http') || normalized.startsWith('/')) {
      return normalized;
    }
    
    // If it's an array (for multi-select), join it
    try {
      const parsed = JSON.parse(answer.answer);
      if (Array.isArray(parsed)) {
        return parsed.join(', ');
      }
    } catch {}
    
    return answer.answer;
  };

  const isImageAnswer = (answer: string): boolean => {
    if (!answer) return false;
    const normalized = normalizeImagePath(answer);
    return normalized.startsWith('http') || normalized.startsWith('/') || 
           normalized.includes('uploads') || 
           /\.(jpg|jpeg|png|gif|webp|pdf)$/i.test(normalized);
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
                  className={`badge ${
                    survey.status === 'Completed' ? 'bg-success' : 'bg-warning'
                  }`}
                >
                  {survey.status === 'Completed' ? 'पूर्ण' : 'प्रलंबित'}
                </span>
              </div>
              <div className="col-md-6">
                <strong>वापरकर्ता:</strong>{' '}
                {survey.user_name || `ID: ${survey.user_id}`}
                {survey.user_phone && ` (${survey.user_phone})`}
              </div>
              <div className="col-md-6">
                <strong>उत्तरांची संख्या:</strong> {survey.answer_count}
              </div>
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
            </div>

            {/* Aadhaar Images */}
            {(survey.front_image || survey.back_image) && (
              <div className="row g-3 mt-3">
                {survey.front_image && (
                  <div className="col-md-6">
                    <strong>आधार समोरील:</strong>
                    <div className="mt-2">
                      {(() => {
                        const normalizedPath = normalizeImagePath(survey.front_image);
                        const isValidImage = normalizedPath.startsWith('http') || normalizedPath.startsWith('/');
                        return isValidImage ? (
                          <img
                            src={normalizedPath}
                            alt="Aadhaar Front"
                            className="img-fluid border rounded"
                            style={{ maxHeight: '300px' }}
                            onError={(e) => {
                              // If image fails to load, show fallback
                              (e.target as HTMLImageElement).style.display = 'none';
                              const parent = (e.target as HTMLImageElement).parentElement;
                              if (parent) {
                                parent.innerHTML = `<span class="badge bg-warning">Image not found: ${survey.front_image}</span>`;
                              }
                            }}
                          />
                        ) : (
                          <span className="badge bg-secondary">{survey.front_image}</span>
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
                        const normalizedPath = normalizeImagePath(survey.back_image);
                        const isValidImage = normalizedPath.startsWith('http') || normalizedPath.startsWith('/');
                        return isValidImage ? (
                          <img
                            src={normalizedPath}
                            alt="Aadhaar Back"
                            className="img-fluid border rounded"
                            style={{ maxHeight: '300px' }}
                            onError={(e) => {
                              // If image fails to load, show fallback
                              (e.target as HTMLImageElement).style.display = 'none';
                              const parent = (e.target as HTMLImageElement).parentElement;
                              if (parent) {
                                parent.innerHTML = `<span class="badge bg-warning">Image not found: ${survey.back_image}</span>`;
                              }
                            }}
                          />
                        ) : (
                          <span className="badge bg-secondary">{survey.back_image}</span>
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
                                        <img
                                          src={getAbsoluteImageUrl(answerText)}
                                          alt="Answer"
                                          className="img-fluid border rounded"
                                          style={{ maxHeight: '200px' }}
                                          onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = 'none';
                                            const parent = (e.target as HTMLImageElement).parentElement;
                                            if (parent) {
                                              parent.innerHTML = `<span class="badge bg-warning">Image not found: ${answerText}</span>`;
                                            }
                                          }}
                                        />
                                      ) : (
                                        <span>{answerText || '-'}</span>
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
        {showClarificationModal && (
          <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog modal-dialog-centered modal-lg">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">स्पष्टीकरण विनंती करा</h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => {
                      setShowClarificationModal(false);
                      setSelectedQuestions({});
                    }}
                    disabled={sendingClarification}
                  ></button>
                </div>
                <div className="modal-body">
                  <p className="text-muted mb-3">
                    कृपया स्पष्टीकरण आवश्यक असलेले प्रश्न निवडा आणि प्रत्येक प्रश्नासाठी कारण प्रविष्ट करा.
                  </p>
                  {Object.keys(selectedQuestions).length > 0 && (
                    <div className="alert alert-info mb-3">
                      <i className="bi bi-info-circle me-2"></i>
                      <strong>{Object.keys(selectedQuestions).length}</strong> प्रश्न निवडले आहेत. कृपया खाली सबमिट बटणावर क्लिक करा.
                    </div>
                  )}
                  <div className="table-responsive" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                    <table className="table table-sm">
                      <thead>
                        <tr>
                          <th style={{ width: '5%' }}>ID</th>
                          <th style={{ width: '40%' }}>प्रश्न</th>
                          <th style={{ width: '55%' }}>कारण</th>
                        </tr>
                      </thead>
                      <tbody>
                        {answers.map((ans, ansIdx) => {
                          const questionKey = ans.question_id;
                          const isSelected = selectedQuestions.hasOwnProperty(questionKey);
                          
                          // Create unique key combining section_id, question_id, and index to avoid duplicates
                          const uniqueKey = `clarification_${ans.section_id || 0}_${ans.question_id}_${ansIdx}`;
                          
                          return (
                            <tr key={uniqueKey}>
                              <td>
                                <input
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
                                />
                              </td>
                              <td>
                                <small>
                                  {ans.question_marathi || ans.question_english || `Question ${ans.question_id}`}
                                </small>
                              </td>
                              <td>
                                {isSelected ? (
                                  <textarea
                                    className="form-control form-control-sm"
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
                                  />
                                ) : (
                                  <span className="text-muted">-</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="modal-footer" style={{ borderTop: '2px solid #dee2e6', padding: '15px', backgroundColor: '#f8f9fa' }}>
                  <div className="d-flex justify-content-between align-items-center w-100">
                    <div>
                      {Object.keys(selectedQuestions).length > 0 ? (
                        <span className="text-success">
                          <i className="bi bi-check-circle me-1"></i>
                          <strong>{Object.keys(selectedQuestions).length}</strong> प्रश्न निवडले
                        </span>
                      ) : (
                        <span className="text-muted">कृपया किमान एक प्रश्न निवडा</span>
                      )}
                    </div>
                    <div className="d-flex gap-2">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                          setShowClarificationModal(false);
                          setSelectedQuestions({});
                        }}
                        disabled={sendingClarification}
                      >
                        <i className="bi bi-x-circle me-1"></i>
                        रद्द करा
                      </button>
                      <button
                        type="button"
                        className="btn btn-warning btn-lg"
                        onClick={handleRequestClarification}
                        disabled={sendingClarification || Object.keys(selectedQuestions).length === 0}
                        style={{ minWidth: '200px' }}
                      >
                        {sendingClarification ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                            पाठवत आहे...
                          </>
                        ) : (
                          <>
                            <i className="bi bi-send-fill me-2"></i>
                            <strong>स्पष्टीकरण विनंती पाठवा</strong>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Reject Modal */}
        {showRejectModal && (
          <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">सर्वेक्षण नाकारा</h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => {
                      setShowRejectModal(false);
                      setRejectionReason('');
                    }}
                    disabled={markingRejected}
                  ></button>
                </div>
                <div className="modal-body">
                  <div className="mb-3">
                    <label htmlFor="rejectionReason" className="form-label">
                      <strong>नाकारण्याचे कारण:</strong>
                    </label>
                    <textarea
                      id="rejectionReason"
                      className="form-control"
                      rows={4}
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="कृपया सर्वेक्षण नाकारण्याचे कारण प्रविष्ट करा..."
                      disabled={markingRejected}
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
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
                    className="btn btn-danger"
                    onClick={handleMarkRejected}
                    disabled={markingRejected || !rejectionReason.trim()}
                  >
                    {markingRejected ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                        नाकारत आहे...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-x-circle me-2"></i>
                        नाकारा
                      </>
                    )}
                  </button>
                </div>
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

