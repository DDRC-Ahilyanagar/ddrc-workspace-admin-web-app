'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiCall, uploadImage, submitAnswers, processOCR, processOCRDual } from '@/lib/api-client';
import AdminLayout from '@/components/AdminLayout';
import DataTable from 'datatables.net-react';

interface Question {
  id: number;
  section_id: number;
  question: string;
  question_type: string;
  multi_select: number;
  options?: string;
  rendering_condition?: string;
  rendering_question?: string;
  rendering_value?: string;
  regex?: string;
  valid_input?: string;
  max_length?: number;
}

interface Section {
  id: number;
  name: string;
  description?: string | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

type OcrDefaults = {
  aadhaar?: string;
  name?: string;
  gender?: string;
  dob?: string;
  address?: string;
};

function SectionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sectionId = parseInt(searchParams.get('section_id') || '1');
  const aadharId = parseInt(searchParams.get('aadhar_id') || '0');

  const [questions, setQuestions] = useState<Question[]>([]);
  const [sectionName, setSectionName] = useState('');
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [sections, setSections] = useState<Section[]>([]);
  const [showSectionsList, setShowSectionsList] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editorLoaded, setEditorLoaded] = useState(false);
  const [EditorComponent, setEditorComponent] = useState<any>(null);
  const [EditorClass, setEditorClass] = useState<any>(null);
  const tableRef = useRef<any>(null);
  const [dtReady, setDtReady] = useState(false);
  const sectionsRef = useRef<Section[]>([]);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [aadhaarFrontFile, setAadhaarFrontFile] = useState<File | null>(null);
  const [aadhaarBackFile, setAadhaarBackFile] = useState<File | null>(null);
  const [aiBusy, setAiBusy] = useState(false);

  const getOcrStorageKey = () => (aadharId ? `ocr_defaults_${aadharId}` : '');

  const readOcrDefaults = (): OcrDefaults => {
    if (typeof window === 'undefined' || !aadharId) return {};
    try {
      const raw = localStorage.getItem(getOcrStorageKey());
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  };

  const persistOcrDefaults = (partial: OcrDefaults) => {
    if (typeof window === 'undefined' || !aadharId) return;
    const key = getOcrStorageKey();
    if (!key) return;
    const current = readOcrDefaults();
    let changed = false;
    Object.entries(partial || {}).forEach(([field, value]) => {
      if (typeof value !== 'string') return;
      const trimmed = value.trim();
      if (!trimmed) return;
      if (current[field as keyof OcrDefaults] !== trimmed) {
        current[field as keyof OcrDefaults] = trimmed;
        changed = true;
      }
    });
    if (changed) {
      localStorage.setItem(key, JSON.stringify(current));
    }
  };

  const mergeAnswersWithOcr = (baseAnswers: Record<string, any>, sectionQuestions: Question[]) => {
    if (!sectionQuestions.length) return baseAnswers;
    const defaults = readOcrDefaults();
    if (!Object.keys(defaults).length) return baseAnswers;
    const merged = { ...baseAnswers };
    const setIfMissing = (predicate: (q: Question) => boolean, value?: string) => {
      if (!value) return;
      const qMatch = sectionQuestions.find(predicate);
      if (!qMatch) return;
      const existing = merged[qMatch.id];
      if (existing === undefined || existing === null || existing === '') {
        merged[qMatch.id] = value;
      }
    };
    setIfMissing(
      (q) => (q.question.includes('आधार') || q.question.toLowerCase().includes('aadhaar')) && q.question_type.toLowerCase() !== 'upload',
      defaults.aadhaar
    );
    setIfMissing(
      (q) => q.question.toLowerCase().includes('name') || q.question.includes('नाव'),
      defaults.name
    );
    setIfMissing(
      (q) => q.question.toLowerCase().includes('gender') || q.question.includes('लिंग'),
      defaults.gender
    );
    setIfMissing(
      (q) => q.question.toLowerCase().includes('dob') || q.question.includes('जन्म'),
      defaults.dob
    );
    setIfMissing(
      (q) => q.question.toLowerCase().includes('address') || q.question.includes('पत्ता'),
      defaults.address
    );
    return merged;
  };

  // One-time init DataTables (guarded against React StrictMode double-invoke)
  const didInitRef = useRef(false);
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    (async () => {
      try {
        const core: any = await import('datatables.net-bs5');
        const lib = (core && core.default) ? core.default : core;
        if (lib && (DataTable as any).use) {
          (DataTable as any).use(lib as any);
          setDtReady(true);
        }
      } catch (e) {
        console.error('Failed to init DataTables core', e);
      }
    })();
  }, []);

  useEffect(() => {
    if (!aadharId) {
      // Show sections list instead of redirecting
      setShowSectionsList(true);
      loadSections();
      setLoading(false);
      return;
    }
    setShowSectionsList(false);
    loadQuestions();
  }, [sectionId, aadharId]);

  // Update ref when sections change
  useEffect(() => {
    sectionsRef.current = sections;
  }, [sections]);

  // Load CKEditor dynamically
  useEffect(() => {
    if (showEditModal && !editorLoaded) {
      Promise.all([
        import('@ckeditor/ckeditor5-react').then(mod => mod.CKEditor),
        import('@ckeditor/ckeditor5-build-classic')
      ]).then(([CKEditor, ClassicEditor]) => {
        setEditorComponent(() => CKEditor);
        setEditorClass(ClassicEditor.default || ClassicEditor);
        setEditorLoaded(true);
      }).catch(err => {
        console.error('Failed to load CKEditor:', err);
      });
    }
  }, [showEditModal, editorLoaded]);

  const loadSections = async () => {
    try {
      const res = await fetch('/api/admin/sections');
      const data = await res.json();
      if (data.ok && data.data) {
        // Sort sections by ID in ascending order
        const sortedSections = (data.data || []).sort((a: Section, b: Section) => a.id - b.id);
        setSections(sortedSections);
      }
    } catch (e) {
      console.error('Failed to load sections:', e);
    }
  };

  // Setup global handlers for DataTable actions
  useEffect(() => {
    (window as any).handleEditSection = (id: number) => {
      const section = sectionsRef.current.find(s => s.id === id);
      if (section) handleEdit(section);
    };
    (window as any).handleDeleteSection = (id: number) => {
      openDeleteModal(id);
    };
    return () => {
      delete (window as any).handleEditSection;
      delete (window as any).handleDeleteSection;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openDeleteModal = (id: number) => {
    setDeleteId(id);
    setDeleteReason('');
    setShowDeleteModal(true);
  };

  const performDelete = async () => {
    if (!deleteId) return;
    if (!deleteReason.trim()) {
      alert('कृपया हटवण्याचे कारण द्या.');
      return;
    }
    try {
      const res = await fetch(`/api/admin/sections?id=${deleteId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: deleteReason.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        await loadSections();
        setShowDeleteModal(false);
        setDeleteId(null);
        setDeleteReason('');
      } else {
        alert('त्रुटी: ' + (data.error || 'हटवणे अयशस्वी'));
      }
    } catch (e) {
      console.error('Failed to delete section:', e);
      alert('विभाग हटवणे अयशस्वी');
    }
  };

  const handleEdit = (section: Section) => {
    setEditingSection({ ...section });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingSection) return;
    if (!editingSection.name || !editingSection.name.trim()) {
      alert('विभागाचे नाव आवश्यक आहे');
      return;
    }
    try {
      const res = await fetch('/api/admin/sections', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingSection.id,
          name: editingSection.name.trim(),
          description: editingSection.description || null,
          status: editingSection.status || 'Active',
        }),
      });
      const data = await res.json();
      if (data.ok) {
        await loadSections();
        setShowEditModal(false);
        setEditingSection(null);
      } else {
        alert('त्रुटी: ' + (data.error || 'अपडेट अयशस्वी'));
      }
    } catch (e) {
      console.error('Failed to update section:', e);
      alert('अपडेट अयशस्वी');
    }
  };

  const loadQuestions = async () => {
    setLoading(true);
    try {
      const response = await apiCall('get-questions');
      if (response.ok && response.data) {
        const allQuestions = response.data as Question[];
        const sectionQuestions = allQuestions.filter(q => q.section_id === sectionId);
        setQuestions(sectionQuestions);
        
        // Get section name
        const sectionResponse = await apiCall(`get-section-name?section_id=${sectionId}`);
        if (sectionResponse.ok && sectionResponse.name) {
          setSectionName(sectionResponse.name);
        }
        
        // Load saved answers from localStorage
        const savedAnswers = localStorage.getItem(`answers_${aadharId}_${sectionId}`);
        const parsedAnswers = savedAnswers ? JSON.parse(savedAnswers) : {};
        const answersWithOcr = mergeAnswersWithOcr(parsedAnswers, sectionQuestions);
        setAnswers(answersWithOcr);
        localStorage.setItem(`answers_${aadharId}_${sectionId}`, JSON.stringify(answersWithOcr));
      }
    } catch (err: any) {
      setError('प्रश्न लोड करण्यात अडचण');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (questionId: number, value: any) => {
    const newAnswers = { ...answers, [questionId]: value };
    setAnswers(newAnswers);
    localStorage.setItem(`answers_${aadharId}_${sectionId}`, JSON.stringify(newAnswers));
  };

  const handleFileUpload = async (questionId: number, file: File | null) => {
    if (!file) return;
    
    const uploaded = await uploadImage(file);
    if (uploaded) {
      handleAnswerChange(questionId, uploaded);
      
      // Check if this is a UDID or Aadhaar upload and process OCR
      const question = questions.find(q => q.id === questionId);
      if (question) {
        const qLabel = question.question.toLowerCase();
        if (qLabel.includes('udid') || qLabel.includes('यूडीआयडी')) {
          // Process UDID OCR
          try {
            const ocrResult = await processOCR(file, 'udid');
            if (ocrResult.ok && ocrResult.udid_info) {
              const udidInfo = ocrResult.udid_info;
              
              // Auto-fill UDID number if found
              if (udidInfo.udid) {
                // Find and fill UDID field
                const udidQuestion = questions.find(q => 
                  q.question.toLowerCase().includes('udid') && 
                  q.id !== questionId &&
                  q.question_type.toLowerCase() !== 'upload'
                );
                if (udidQuestion) {
                  handleAnswerChange(udidQuestion.id, udidInfo.udid);
                }
              }
              
              // Auto-fill disability type if found
              if (udidInfo.disability_type) {
                const disabilityQuestion = questions.find(q => 
                  (q.question.includes('दिव्यांगता प्रकार') || 
                   q.question.toLowerCase().includes('disability type')) &&
                  q.question_type.toLowerCase() === 'mcq'
                );
                if (disabilityQuestion) {
                  handleAnswerChange(disabilityQuestion.id, udidInfo.disability_type);
                }
              }
              
              // Auto-fill disability percentage
              if (udidInfo.disability_percentage) {
                const percentageQuestion = questions.find(q => 
                  (q.question.includes('टक्केवारी') || 
                   q.question.toLowerCase().includes('percentage')) &&
                  q.question_type.toLowerCase() !== 'mcq'
                );
                if (percentageQuestion) {
                  handleAnswerChange(percentageQuestion.id, udidInfo.disability_percentage);
                }
              }
              
              // Auto-fill validity date
              if (udidInfo.validity_date) {
                const validityQuestion = questions.find(q => 
                  (q.question.includes('वैध') || 
                   q.question.toLowerCase().includes('valid')) &&
                  q.question_type.toLowerCase() !== 'mcq'
                );
                if (validityQuestion) {
                  handleAnswerChange(validityQuestion.id, udidInfo.validity_date);
                }
              }
              
              // Auto-fill issue date
              if (udidInfo.issue_date) {
                const issueQuestion = questions.find(q => 
                  (q.question.includes('मिळाल्याची') || 
                   q.question.includes('जारी') ||
                   q.question.toLowerCase().includes('issue date')) &&
                  q.question_type.toLowerCase() !== 'mcq'
                );
                if (issueQuestion) {
                  handleAnswerChange(issueQuestion.id, udidInfo.issue_date);
                }
              }
            }
          } catch (err) {
            console.error('UDID OCR processing failed:', err);
          }
        } else if (qLabel.includes('aadhaar') || qLabel.includes('आधार')) {
          // track front/back by keyword if present
          if (/back|rear|मागील/i.test(question.question)) {
            setAadhaarBackFile(file);
          } else if (/front|समोरील|पुढील/i.test(question.question)) {
            setAadhaarFrontFile(file);
          } else {
            // If ambiguous, treat as front by default
            setAadhaarFrontFile(file);
          }
          // Process Aadhaar OCR
          try {
            const ocrResult = await processOCR(file, 'aadhaar');
            if (ocrResult.ok && ocrResult.aadhaar_info) {
              const aadhaarInfo = ocrResult.aadhaar_info;
              persistOcrDefaults({
                aadhaar: aadhaarInfo.aadhaar,
                name: aadhaarInfo.name,
                gender: aadhaarInfo.gender,
                dob: aadhaarInfo.dob,
                address: aadhaarInfo.address,
              });
              
              // Auto-fill Aadhaar number if found
              if (aadhaarInfo.aadhaar) {
                const aadhaarQuestion = questions.find(q => 
                  (q.question.includes('आधार') || 
                   q.question.toLowerCase().includes('aadhaar')) &&
                  q.id !== questionId &&
                  q.question_type.toLowerCase() !== 'upload'
                );
                if (aadhaarQuestion) {
                  handleAnswerChange(aadhaarQuestion.id, aadhaarInfo.aadhaar);
                }
              }
            }
          } catch (err) {
            console.error('Aadhaar OCR processing failed:', err);
          }
        }
      }
    }
  };

  const handleTryWithAI = async () => {
    try {
      if (!window.confirm('Are you sure you want to try AI extraction?')) return;
      // Prefer stored passkey to avoid extra API calls
      let passkey = (typeof window !== 'undefined' ? localStorage.getItem('user_passkey') : '') || '';
      if (!passkey) {
        passkey = window.prompt('Enter your 4-digit passkey to proceed (or leave blank to auto-generate):') || '';
      }
      passkey = passkey.trim();
      if (!passkey) {
        // auto-generate via API
        try {
          const gen = await apiCall('users/generate-passkey', { method: 'POST', headers: { Authorization: 'Bearer ' + (localStorage.getItem('user_phone') || '') } as any });
          if (gen.ok && gen.passkey) {
            passkey = String(gen.passkey);
            // Persist silently so subsequent requests don't need API calls
            try { localStorage.setItem('user_passkey', passkey); } catch {}
          } else {
            alert(gen.error || 'Failed to generate passkey');
            return;
          }
        } catch {
          alert('Failed to generate passkey');
          return;
        }
      }

      setAiBusy(true);
      // Save provided passkey for future use; never display in UI
      try { localStorage.setItem('user_passkey', passkey); } catch {}
      const res = await processOCRDual(aadhaarFrontFile, aadhaarBackFile, 'aadhaar', passkey);
      if (res.ok && res.aadhaar_info) {
        const info = res.aadhaar_info as any;
        persistOcrDefaults({
          aadhaar: info.aadhaar,
          name: info.name,
          gender: info.gender,
          dob: info.dob,
          address: info.address,
        });
        // Map to known fields if questions exist
        const setIf = (predicate: (q: Question) => boolean, value?: string) => {
          if (!value) return;
          const q = questions.find(predicate);
          if (q) handleAnswerChange(q.id, value);
        };
        setIf(q => (q.question.includes('आधार') || q.question.toLowerCase().includes('aadhaar')) && q.question_type.toLowerCase() !== 'upload', info.aadhaar);
        setIf(q => q.question.toLowerCase().includes('name') || q.question.includes('नाव'), info.name);
        setIf(q => q.question.toLowerCase().includes('gender') || q.question.includes('लिंग'), info.gender);
        setIf(q => q.question.toLowerCase().includes('dob') || q.question.includes('जन्म'), info.dob);
        setIf(q => q.question.toLowerCase().includes('address') || q.question.includes('पत्ता'), info.address);
      } else if (!res.ok) {
        alert(res.error || 'AI extraction failed');
      }
    } finally {
      setAiBusy(false);
    }
  };

  const shouldShowQuestion = (q: Question): boolean => {
    if (!q.rendering_condition || q.rendering_condition === 'No') return true;
    
    const renderingQuestion = questions.find(x => 
      x.id.toString() === q.rendering_question?.toString() ||
      x.question === q.rendering_question
    );
    if (!renderingQuestion) return false;
    
    const renderingAnswer = answers[renderingQuestion.id];
    if (!renderingAnswer) return false;
    
    const renderingValues = q.rendering_value?.split(',').map(v => v.trim()) || [];
    return renderingValues.includes(renderingAnswer.toString());
  };

  const renderQuestion = (q: Question) => {
    if (!shouldShowQuestion(q)) return null;

    const questionId = q.id.toString();
    const currentAnswer = answers[q.id];

    switch (q.question_type.toLowerCase()) {
      case 'mcq':
        const options = q.options?.split(',').map(o => o.trim()) || [];
        const isMultiSelect = q.multi_select === 1;
        
        if (isMultiSelect) {
          const selectedValues = Array.isArray(currentAnswer) ? currentAnswer : [];
          return (
            <div key={q.id} className="mb-4">
              <label className="form-label">{q.question}</label>
              {options.map((opt, idx) => (
                <div key={idx} className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    checked={selectedValues.includes(opt)}
                    onChange={(e) => {
                      const newValues = e.target.checked
                        ? [...selectedValues, opt]
                        : selectedValues.filter(v => v !== opt);
                      handleAnswerChange(q.id, newValues);
                    }}
                  />
                  <label className="form-check-label">{opt}</label>
                </div>
              ))}
            </div>
          );
        } else {
          return (
            <div key={q.id} className="mb-4">
              <label className="form-label">{q.question}</label>
              <select
                className="form-select"
                value={currentAnswer || ''}
                onChange={(e) => handleAnswerChange(q.id, e.target.value)}
              >
                <option value="">निवडा</option>
                {options.map((opt, idx) => (
                  <option key={idx} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          );
        }

      case 'short_answer':
      case 'text':
        return (
          <div key={q.id} className="mb-4">
            <label className="form-label">{q.question}</label>
            <input
              type="text"
              className="form-control"
              value={currentAnswer || ''}
              onChange={(e) => handleAnswerChange(q.id, e.target.value)}
              maxLength={q.max_length || undefined}
            />
          </div>
        );

      case 'long_answer':
        return (
          <div key={q.id} className="mb-4">
            <label className="form-label">{q.question}</label>
            <textarea
              className="form-control col-12 mb-3"
              rows={4}
              value={currentAnswer || ''}
              onChange={(e) => handleAnswerChange(q.id, e.target.value)}
              maxLength={q.max_length || undefined}
            />
          </div>
        );

      case 'date':
        return (
          <div key={q.id} className="mb-4">
            <label className="form-label">{q.question}</label>
            <input
              type="date"
              className="form-control"
              value={currentAnswer || ''}
              onChange={(e) => handleAnswerChange(q.id, e.target.value)}
            />
          </div>
        );

      case 'upload':
        return (
          <div key={q.id} className="mb-4">
            <label className="form-label">{q.question}</label>
            <input
              ref={(el) => {
                fileInputRefs.current[questionId] = el;
              }}
              type="file"
              className="form-control"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleFileUpload(q.id, file);
                }
              }}
            />
            {currentAnswer && (
              <div className="mt-2">
                <img
                  src={currentAnswer}
                  alt="Uploaded"
                  className="img-fluid"
                  style={{ maxHeight: '200px' }}
                />
                {(q.question.toLowerCase().includes('aadhaar') || q.question.includes('आधार')) && (
                  <div className="mt-2">
                    <button type="button" className="btn btn-outline-primary btn-sm" onClick={handleTryWithAI} disabled={aiBusy}>
                      {aiBusy ? 'Processing…' : 'Try with AI'}
                    </button>
                    <div className="form-text">Uses Gemini; address from back image, others from front. Data not used for training.</div>
                  </div>
                )}
              </div>
            )}
          </div>
        );

      case 'number':
        return (
          <div key={q.id} className="mb-4">
            <label className="form-label">{q.question}</label>
            <input
              type="number"
              className="form-control"
              value={currentAnswer || ''}
              onChange={(e) => handleAnswerChange(q.id, e.target.value)}
            />
          </div>
        );

      default:
        return (
          <div key={q.id} className="mb-4">
            <label className="form-label">{q.question}</label>
            <input
              type="text"
              className="form-control"
              value={currentAnswer || ''}
              onChange={(e) => handleAnswerChange(q.id, e.target.value)}
            />
          </div>
        );
    }
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError('');

    try {
      const items = questions
        .filter(q => shouldShowQuestion(q) && answers[q.id] !== undefined)
        .map(q => ({
          question_id: q.id,
          section_id: q.section_id,
          answer: answers[q.id],
        }));

      const response = await submitAnswers(1, aadharId, items);

      if (response.ok) {
        // Get next section
        const nextSection = sectionId + 1;
        router.push(`/sections?section_id=${nextSection}&aadhar_id=${aadharId}`);
      } else {
        setError(response.error || 'उत्तरे साठवण्यात अडचण');
      }
    } catch (err: any) {
      setError('त्रुटी आली');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container-fluid py-4">
        <div className="text-center">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">लोड होत आहे...</span>
          </div>
        </div>
      </div>
    );
  }

  // Prepare DataTables columns
  const columns = [
    { data: 'id', title: 'ID', width: '80px' },
    { 
      data: 'name', 
      title: 'नाव',
      render: (data: string) => `<strong>${data || '-'}</strong>`
    },
    { 
      data: 'description', 
      title: 'विवरण',
      render: (data: string) => {
        if (!data) return '-';
        // Strip HTML tags for table display
        const div = document.createElement('div');
        div.innerHTML = data;
        const text = div.textContent || div.innerText || '';
        return text.length > 50 ? text.substring(0, 50) + '...' : text;
      }
    },
    { 
      data: 'status', 
      title: 'स्थिती',
      render: (data: string) => {
        const badge = data === 'Active' ? 'bg-success' : 'bg-secondary';
        const text = data || 'Active';
        return `<span class="badge ${badge}">${text}</span>`;
      }
    },
    {
      data: null,
      title: 'क्रिया',
      orderable: false,
      render: (data: any, type: any, row: Section) => {
        return `
          <button class="btn btn-sm btn-outline-primary me-2" onclick="window.handleEditSection(${row.id})" title="संपादन करा">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger" onclick="window.handleDeleteSection(${row.id})" title="हटवा">
            <i class="bi bi-trash"></i>
          </button>
        `;
      }
    }
  ];

  if (showSectionsList) {
    return (
      <>
        <link rel="stylesheet" href="https://cdn.datatables.net/1.13.7/css/jquery.dataTables.min.css" />
        <AdminLayout>
          <div className="container-fluid p-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h2 className="mb-0">प्रश्नावली विभाग</h2>
              <button
                className="btn btn-primary"
                onClick={() => router.push('/survekshan')}
              >
                <i className="bi bi-plus-circle me-2"></i>नवीन सर्वेक्षण सुरू करा
              </button>
            </div>
            <div className="card shadow-sm">
              <div className="card-body">
                {loading ? (
                  <div className="text-center p-5">
                    <div className="spinner-border" role="status">
                      <span className="visually-hidden">लोड होत आहे...</span>
                    </div>
                  </div>
                ) : sections.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-muted">कोणतेही विभाग उपलब्ध नाहीत</p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    {dtReady && (
                      <DataTable
                        ref={tableRef}
                        data={sections}
                        columns={columns}
                        options={{
                          pageLength: 25,
                          lengthMenu: [[10, 25, 50, 100, -1], [10, 25, 50, 100, 'All']],
                          order: [[0, 'asc']], // Sort by ID
                          language: {
                            search: 'शोधा:',
                            lengthMenu: '_MENU_ नोंदी दाखवा',
                            info: '_START_ ते _END_ पैकी _TOTAL_ नोंदी दाखवत आहे',
                            infoEmpty: 'दाखवण्यासाठी नोंदी नाहीत',
                            infoFiltered: '(_MAX_ एकूण नोंदींपैकी फिल्टर केलेले)'
                          },
                          dom: "<'row g-2 mb-3'<'col-12 col-md-8'l><'col-12 col-md-4'f>>" +
                               "rt" +
                               "<'row g-2 mt-3'<'col-12 col-md-5'i><'col-12 col-md-7'p>>",
                        } as any}
                        className="table table-striped align-middle"
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }} tabIndex={-1}>
            <div className="modal-dialog modal-md">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">विभाग हटवा</h5>
                  <button type="button" className="btn-close" onClick={() => setShowDeleteModal(false)}></button>
                </div>
                <div className="modal-body">
                  <p className="mb-3">कृपया या विभाग हटवण्याचे कारण द्या. हे लॉगमध्ये साठवले जाईल.</p>
                  <textarea
                    className="form-control"
                    rows={4}
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                    placeholder="कारण द्या..."
                  />
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>रद्द करा</button>
                  <button type="button" className="btn btn-danger" onClick={performDelete} disabled={!deleteReason.trim()}>
                    हटवा
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {showEditModal && editingSection && (
          <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }} tabIndex={-1}>
            <div className="modal-dialog modal-lg">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">विभाग संपादन करा</h5>
                  <button type="button" className="btn-close" onClick={() => { setShowEditModal(false); setEditingSection(null); }}></button>
                </div>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">विभागाचे नाव *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editingSection.name || ''}
                      onChange={(e) => setEditingSection({ ...editingSection, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">विवरण</label>
                    {editorLoaded && EditorComponent && EditorClass ? (
                      <EditorComponent
                        editor={EditorClass}
                        data={editingSection.description || ''}
                        onChange={(event: any, editor: any) => {
                          const data = editor.getData();
                          setEditingSection({ ...editingSection, description: data });
                        }}
                        config={{
                          toolbar: ['heading', '|', 'bold', 'italic', 'link', 'bulletedList', 'numberedList', 'blockQuote', 'insertTable', '|', 'undo', 'redo'],
                        }}
                      />
                    ) : (
                      <textarea
                        className="form-control"
                        rows={3}
                        value={editingSection.description || ''}
                        onChange={(e) => setEditingSection({ ...editingSection, description: e.target.value })}
                        placeholder="लोड होत आहे..."
                      />
                    )}
                  </div>
                  <div className="mb-3">
                    <label className="form-label">स्थिती</label>
                    <select
                      className="form-select"
                      value={editingSection.status || 'Active'}
                      onChange={(e) => setEditingSection({ ...editingSection, status: e.target.value })}
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => { setShowEditModal(false); setEditingSection(null); }}>रद्द करा</button>
                  <button type="button" className="btn btn-primary" onClick={handleSaveEdit}>
                    साठवा
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        </AdminLayout>
      </>
    );
  }

  return (
    <AdminLayout>
      <div className="container-fluid">
        <div className="row justify-content-center">
          <div className="col-12 col-md-10 col-lg-8">
            <h1 className="title mb-4 animate__animated animate__fadeInDown">{sectionName || `विभाग ${sectionId}`}</h1>
            <div className="card animate__animated animate__fadeInUp">
              <div className="card-body">
              {questions.map(q => renderQuestion(q))}
              
              {error && (
                <div className="alert alert-danger" role="alert">
                  {error}
                </div>
              )}

              <div className="d-flex justify-content-between mt-4">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    if (sectionId > 1) {
                      router.push(`/sections?section_id=${sectionId - 1}&aadhar_id=${aadharId}`);
                    } else {
                      router.push('/dashboard');
                    }
                  }}
                >
                  मागे
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSubmit}
                  disabled={saving}
                >
                  {saving ? (
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                  ) : null}
                  पुढे
                </button>
              </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

export default function SectionsPage() {
  return (
    <Suspense fallback={
      <div className="container-fluid py-4">
        <div className="text-center">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">लोड होत आहे...</span>
          </div>
        </div>
      </div>
    }>
      <SectionsContent />
    </Suspense>
  );
}

