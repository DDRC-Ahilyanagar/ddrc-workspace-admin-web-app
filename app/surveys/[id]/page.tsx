'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AdminLayout from '@/components/AdminLayout';

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

    loadSurveyDetails();
  }, [surveyId]);

  const formatAnswer = (answer: Answer): string => {
    if (!answer.answer) return '-';
    
    // If it's an image URL, return it as-is for display
    if (answer.answer.startsWith('http') || answer.answer.startsWith('/')) {
      return answer.answer;
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
    return answer.startsWith('http') || answer.startsWith('/');
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
                      {survey.front_image.startsWith('http') || survey.front_image.startsWith('/') ? (
                        <img
                          src={survey.front_image}
                          alt="Aadhaar Front"
                          className="img-fluid border rounded"
                          style={{ maxHeight: '300px' }}
                        />
                      ) : (
                        <span className="badge bg-secondary">{survey.front_image}</span>
                      )}
                    </div>
                  </div>
                )}
                {survey.back_image && (
                  <div className="col-md-6">
                    <strong>आधार मागील:</strong>
                    <div className="mt-2">
                      {survey.back_image.startsWith('http') || survey.back_image.startsWith('/') ? (
                        <img
                          src={survey.back_image}
                          alt="Aadhaar Back"
                          className="img-fluid border rounded"
                          style={{ maxHeight: '300px' }}
                        />
                      ) : (
                        <span className="badge bg-secondary">{survey.back_image}</span>
                      )}
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
                          <th style={{ width: '40%' }}>प्रश्न</th>
                          <th style={{ width: '55%' }}>उत्तर</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sectionAnswers.map((ans) => {
                          const answerText = formatAnswer(ans);
                          const isImage = isImageAnswer(answerText);
                          return (
                            <tr key={ans.id}>
                              <td>{ans.question_id}</td>
                              <td>
                                <strong>
                                  {ans.question_marathi || ans.question_english || `Question ${ans.question_id}`}
                                </strong>
                              </td>
                              <td>
                                {isImage ? (
                                  <div>
                                    <img
                                      src={answerText}
                                      alt="Answer"
                                      className="img-fluid border rounded"
                                      style={{ maxHeight: '200px' }}
                                    />
                                  </div>
                                ) : (
                                  <div>{answerText}</div>
                                )}
                              </td>
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

