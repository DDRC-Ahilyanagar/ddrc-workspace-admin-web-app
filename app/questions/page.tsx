'use client';

import React, { useState, useEffect, useRef } from 'react';
import AdminLayout from '@/components/AdminLayout';
import DataTable from 'datatables.net-react';

export const dynamic = 'force-dynamic';

interface Question {
  question_id: number;
  section_id: number;
  question_marathi: string;
  question_english: string | null;
  question_type: string;
  options: string | null;
  regex: string | null;
  valid_input: string | null;
  max_length: number | null;
  is_required: number;
  question_is_active: number;
  question_sort_order: number;
  rendering_condition: string | null;
  question_created_at: string | null;
  question_updated_at: string | null;
  question_title: string | null;
  section_title_marathi: string; // Section name in Marathi
  section_title_english: string | null;
  section_sort_order: number;
  section_is_active: number;
}

interface Section {
  id: number;
  name: string;
  description: string | null;
  status: string;
}

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [sectionFilter, setSectionFilter] = useState('');
  const [sections, setSections] = useState<string[]>([]);
  const [dbSections, setDbSections] = useState<Section[]>([]);
  const tableRef = useRef<any>(null);
  const [dtReady, setDtReady] = useState(false);
  const questionsRef = useRef<Question[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteReason, setDeleteReason] = useState<string>('');

  // One-time init and first load only (guarded against React StrictMode double-invoke)
  const didInitRef = useRef(false);
  useEffect(() => {
    if (didInitRef.current) return; // prevent dev double-fetch
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

    // Sequence: questions, then sections (reduces rate-limit burst)
    // Fetch once from a single combined endpoint (cached server-side)
    (async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/admin/questions_view');
        const data = await res.json();
        if (data.ok && data.data) {
          const { questions: qList, sections: sList } = data.data;
          // Ensure only real question rows make it to the table
          const tableRows = (qList || []).filter((q: any) => !!q?.question_id);
          setQuestions(tableRows);
          // Sections provided separately for the dropdown
          setSections((sList || []) as string[]);
        } else {
          console.error('Questions View API error:', data?.error || 'Unknown error');
          setQuestions([]);
          setSections([]);
        }
      } catch (e) {
        console.error('Failed to load questions view:', e);
        setQuestions([]);
        setSections([]);
      } finally {
        setLoading(false);
      }
    })();

    (window as any).handleEditQuestion = (id: number) => {
      const question = questionsRef.current.find(q => q.question_id === id);
      if (question) handleEdit(question);
    };
    (window as any).handleDeleteQuestion = (id: number) => {
      if (id) openDeleteModal(id);
    };

    return () => {
      delete (window as any).handleEditQuestion;
      delete (window as any).handleDeleteQuestion;
    };
  }, []);

  // Keep latest questions in a ref (avoids re-running the init effect)
  useEffect(() => {
    questionsRef.current = questions;
  }, [questions]);

  useEffect(() => {
    // Filter questions when section filter changes
    if (tableRef.current && sectionFilter) {
      const table = tableRef.current;
      // Filter by section
      table.column(3).search(sectionFilter).draw();
    } else if (tableRef.current && !sectionFilter) {
      const table = tableRef.current;
      table.column(3).search('').draw();
    }
  }, [sectionFilter]);

  const loadQuestions = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/questions');
      const data = await res.json();
      if (data.ok && data.data) {
        setQuestions(data.data || []);
        const questions = (data.data || []) as Question[];
        // Use section_title_marathi from the view
        const uniqueSections: string[] = Array.from(new Set(questions.map(q => q.section_title_marathi).filter((t): t is string => typeof t === 'string' && t.length > 0)));
        setSections(uniqueSections);
      } else {
        console.error('Questions API error:', data?.error || 'Unknown error');
        setQuestions([]);
      }
    } catch (e) {
      console.error('Failed to load questions:', e);
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  };

  const loadSections = async () => {
    try {
      const res = await fetch('/api/admin/sections');
      const data = await res.json();
      if (data.ok && data.data) {
        setDbSections(data.data || []);
        // Use DB sections for dropdown
        const dbSectionNames = (data.data || []).map((s: Section) => s.name).filter((t: string | undefined): t is string => typeof t === 'string' && t.length > 0);
        // Also merge with question titles if they exist
        const questionTitles = questions.map(q => q.section_title_marathi || q.question_title).filter((t: string | null | undefined): t is string => typeof t === 'string' && t.length > 0);
        const allSections = Array.from(new Set([...dbSectionNames, ...questionTitles]));
        setSections(allSections);
      } else {
        console.error('Sections API error:', data?.error || 'Unknown error');
        setSections([]);
      }
    } catch (e) {
      console.error('Failed to load sections:', e);
      setSections([]);
    }
  };

  const handleSave = async (q: Question) => {
    try {
      const url = '/api/admin/questions';
      const method = q.question_id ? 'PUT' : 'POST';
      const body = { ...q, question_id: q.question_id, id: q.question_id };
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      const data = await res.json();
      if (data.ok) {
        await loadQuestions();
        await loadSections();
        setShowModal(false);
        setEditingQuestion(null);
      } else {
        alert('Error: ' + (data.error || 'Failed to save'));
      }
    } catch (e) {
      console.error('Failed to save question:', e);
      alert('Failed to save question');
    }
  };

  const openDeleteModal = (id: number) => {
    setDeleteId(id);
    setDeleteReason('');
    setShowDeleteModal(true);
  };

  const performDelete = async () => {
    if (!deleteId) return;
    if (!deleteReason.trim()) {
      alert('Please provide a reason for deletion.');
      return;
    }
    try {
      const res = await fetch(`/api/admin/questions?id=${deleteId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: deleteReason.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        await loadQuestions();
        setShowDeleteModal(false);
        setDeleteId(null);
        setDeleteReason('');
      } else {
        alert('Error: ' + (data.error || 'Failed to delete'));
      }
    } catch (e) {
      console.error('Failed to delete question:', e);
      alert('Failed to delete question');
    }
  };

  const handleNew = () => {
    setEditingQuestion({
      question_id: 0,
      section_id: 1,
      question_marathi: '',
      question_english: null,
      question_type: 'short_answer',
      options: null,
      regex: null,
      valid_input: null,
      max_length: null,
      is_required: 1,
      question_is_active: 1,
      question_sort_order: 0,
      rendering_condition: null,
      question_created_at: null,
      question_updated_at: null,
      question_title: null,
      section_title_marathi: '',
      section_title_english: null,
      section_sort_order: 0,
      section_is_active: 1,
    });
    setShowModal(true);
  };

  const handleEdit = (q: Question) => {
    const questionWithDefaults = {
      ...q,
      valid_input: q.valid_input || null,
      max_length: q.max_length || null,
    };
    setEditingQuestion(questionWithDefaults);
    setShowModal(true);
  };

  // Prepare DataTables columns
  const columns = [
    { data: 'question_id', title: 'ID', width: '80px' },
    { 
      data: 'question_marathi', 
      title: 'Question (Marathi)',
      render: (data: string) => data || '-'
    },
    { 
      data: 'question_type', 
      title: 'Type',
      render: (data: string) => `<span class="badge bg-secondary">${data}</span>`
    },
    { 
      data: 'section_title_marathi', 
      title: 'Section',
      render: (data: string, type: any, row: Question) => 
        `<strong class="text-primary">${data || row.question_title || `Section ${row.section_id}`}</strong>`
    },
    { 
      data: 'options', 
      title: 'Options',
      render: (data: string) => {
        if (!data) return '-';
        const truncated = data.length > 50 ? data.substring(0, 50) + '...' : data;
        return `<small class="text-muted">${truncated}</small>`;
      }
    },
    { 
      data: 'is_required', 
      title: 'Required',
      render: (data: number) => {
        const badge = data ? 'bg-warning' : 'bg-secondary';
        const text = data ? 'Yes' : 'No';
        return `<span class="badge ${badge}">${text}</span>`;
      }
    },
    { 
      data: 'question_is_active', 
      title: 'Active',
      render: (data: number) => {
        const badge = data ? 'bg-success' : 'bg-secondary';
        const text = data ? 'Active' : 'Inactive';
        return `<span class="badge ${badge}">${text}</span>`;
      }
    },
    { data: 'question_sort_order', title: 'Sort Order', width: '100px' },
    { 
      data: 'rendering_condition', 
      title: 'Rendering Condition',
      render: (data: string) => {
        if (!data) return '-';
        const truncated = data.length > 50 ? data.substring(0, 50) + '...' : data;
        return `<small class="text-muted">${truncated}</small>`;
      }
    },
    {
      data: null,
      title: 'Actions',
      orderable: false,
      render: (data: any, type: any, row: Question) => {
        return `
          <button class="btn btn-sm btn-outline-primary me-2" onclick="window.handleEditQuestion(${row.question_id})">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger" onclick="window.handleDeleteQuestion(${row.question_id})">
            <i class="bi bi-trash"></i>
          </button>
        `;
      }
    }
  ];

  return (
    <>
      <link rel="stylesheet" href="https://cdn.datatables.net/1.13.7/css/jquery.dataTables.min.css" />
      <AdminLayout>
        <div className="container-fluid p-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2 className="mb-0">सर्वेक्षण प्रश्नावली</h2>
          <button className="btn btn-primary" onClick={handleNew}>
            <i className="bi bi-plus-circle me-2"></i>Add Question
          </button>
        </div>

        <div className="card shadow-sm">
          <div className="card-body">
            <div className="row mb-3">
              <div className="col-md-12">
                <select
                  className="form-select"
                  value={sectionFilter}
                  onChange={(e) => setSectionFilter(e.target.value)}
                  style={{ maxWidth: '300px' }}
                >
                  <option value="">All Sections</option>
                  {sections.map((s, idx) => (
                    <option key={`section-${idx}-${s}`} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            {loading ? (
              <div className="text-center p-5">
                <div className="spinner-border" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
              </div>
            ) : (
              <div className="table-responsive">
                {dtReady && (
                <DataTable
                  ref={tableRef}
                  data={questions}
                  columns={columns}
                  options={{
                    pageLength: 25,
                    lengthMenu: [[10, 25, 50, 100, -1], [10, 25, 50, 100, 'All']],
                    order: [[7, 'asc']], // Sort by question_sort_order
                    language: {
                      search: 'Search:',
                      lengthMenu: 'Show _MENU_ entries',
                      info: 'Showing _START_ to _END_ of _TOTAL_ entries',
                      infoEmpty: 'No entries to show',
                      infoFiltered: '(filtered from _MAX_ total entries)'
                    },
                    // Place length (l) 8-cols left and filter (f) 4-cols right, both left-aligned
                    dom: "<'row g-2 mb-3'<'col-12 col-md-8'l><'col-12 col-md-4'f>>" +
                         "rt" +
                         "<'row g-2 mt-3'<'col-12 col-md-5'i><'col-12 col-md-7'p>>",
                  } as any}
                  className="table table-striped align-middle"
                />)}
              </div>
            )}
          </div>
        </div>

        {showModal && editingQuestion && (
          <QuestionModal
            question={editingQuestion}
            allQuestions={questions}
            dbSections={dbSections}
            onSave={handleSave}
            onClose={() => {
              setShowModal(false);
              setEditingQuestion(null);
            }}
            onSectionUpdate={loadSections}
            sectionsList={sections}
          />
        )}
        {showDeleteModal && (
          <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex={-1}>
            <div className="modal-dialog modal-md">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Delete Question</h5>
                  <button type="button" className="btn-close" onClick={() => setShowDeleteModal(false)}></button>
                </div>
                <div className="modal-body">
                  <p className="mb-3">Please provide a reason for deleting this question. This will be stored in logs.</p>
                  <textarea
                    className="form-control"
                    rows={4}
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                    placeholder="Enter reason..."
                  />
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>Cancel</button>
                  <button type="button" className="btn btn-danger" onClick={performDelete} disabled={!deleteReason.trim()}>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        </div>
      </AdminLayout>
    </>
  );
}

function QuestionModal({ question, allQuestions, dbSections, onSave, onClose, onSectionUpdate, sectionsList }: {
  question: Question;
  allQuestions: Question[];
  dbSections: Section[];
  onSave: (q: Question) => void;
  onClose: () => void;
  onSectionUpdate: () => void;
  sectionsList: string[];
}) {
  const [formData, setFormData] = useState<Question>({
    ...question,
    valid_input: question.valid_input || null,
    max_length: question.max_length || null,
  });
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [sectionInput, setSectionInput] = useState('');
  const [sectionMode, setSectionMode] = useState<'select' | 'new' | 'edit'>('select');
  const [sampleValue, setSampleValue] = useState<string>('');
  const [generatedRegex, setGeneratedRegex] = useState<string>(question.regex || '');

  const updateField = (field: keyof Question, value: any) => {
    setFormData({ ...formData, [field]: value });
  };

  const questionTypes = ['short_answer', 'date', 'MCQ', 'upload'];
  const validInputs = ['text', 'numeric', 'alphanumeric', ''];

  // Generate regex from sample value
  const generateRegexFromSample = (sample: string): string => {
    if (!sample || sample.trim() === '') return '';
    
    const trimmed = sample.trim().toUpperCase(); // Convert to uppercase for consistency
    let regex = '^';
    let i = 0;
    
    while (i < trimmed.length) {
      const char = trimmed[i];
      
      // Handle special characters (dashes, slashes, spaces, etc.)
      if (['-', '/', ' ', '_', '.'].includes(char)) {
        regex += `\\${char}`;
        i++;
        continue;
      }
      
      // Detect pattern: letters or digits
      if (/[A-Z]/.test(char)) {
        // Count consecutive letters
        let letterCount = 0;
        while (i < trimmed.length && /[A-Z]/.test(trimmed[i])) {
          letterCount++;
          i++;
        }
        regex += `[A-Z]{${letterCount}}`;
      } else if (/\d/.test(char)) {
        // Count consecutive digits
        let digitCount = 0;
        while (i < trimmed.length && /\d/.test(trimmed[i])) {
          digitCount++;
          i++;
        }
        regex += `\\d{${digitCount}}`;
      } else {
        // Other characters - escape them
        regex += `\\${char}`;
        i++;
      }
    }
    
    regex += '$';
    return regex;
  };

  const handleSampleValueChange = (value: string) => {
    setSampleValue(value);
    const regex = generateRegexFromSample(value);
    setGeneratedRegex(regex);
    if (regex) {
      updateField('regex', regex);
      
      // Auto-detect valid_input and max_length
      const cleanedValue = value.replace(/[^A-Za-z0-9]/g, ''); // Remove separators
      const onlyDigits = /^\d+$/.test(cleanedValue);
      const hasLetters = /[A-Za-z]/.test(cleanedValue);
      
      if (onlyDigits) {
        // Pure numeric (with or without separators)
        updateField('valid_input', 'numeric');
        updateField('max_length', cleanedValue.length); // Use cleaned length (without separators)
      } else if (hasLetters) {
        // Alphanumeric
        updateField('valid_input', 'alphanumeric');
        updateField('max_length', cleanedValue.length); // Use cleaned length
      } else {
        // Default to text if unclear
        updateField('valid_input', 'text');
        updateField('max_length', value.length);
      }
    } else {
      // Clear regex if sample is empty
      updateField('regex', null);
      setGeneratedRegex('');
    }
  };

  const handleSectionSelect = (sectionName: string) => {
    if (sectionName === '__new__') {
      setSectionMode('new');
      setSectionInput('');
      setEditingSection(null);
    } else if (sectionName === '__edit__') {
      const currentSection = dbSections.find(s => s.name === formData.section_title_marathi);
      if (currentSection) {
        setSectionMode('edit');
        setEditingSection(currentSection);
        setSectionInput(currentSection.name);
      }
    } else {
      updateField('section_title_marathi', sectionName);
      setSectionMode('select');
    }
  };

  const handleSaveSection = async () => {
    if (!sectionInput.trim()) return;
    
    try {
      const url = '/api/admin/sections';
      const method = editingSection ? 'PUT' : 'POST';
      const body = editingSection 
        ? { id: editingSection.id, name: sectionInput.trim(), status: editingSection.status }
        : { name: sectionInput.trim(), status: 'Active' };
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      const data = await res.json();
      if (data.ok) {
        updateField('section_title_marathi', sectionInput.trim());
        setSectionMode('select');
        setSectionInput('');
        setEditingSection(null);
        onSectionUpdate();
      } else {
        alert('Error: ' + (data.error || 'Failed to save section'));
      }
    } catch (e) {
      console.error('Failed to save section:', e);
      alert('Failed to save section');
    }
  };

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex={-1}>
      <div className="modal-dialog modal-lg modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{question.question_id ? 'Edit Question' : 'New Question'}</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            <div className="row mb-3">
              <div className="col-md-6">
                <label className="form-label">Section/Title</label>
                {sectionMode === 'select' ? (
                  <div className="input-group">
                    <select
                      className="form-select"
                      value={formData.section_title_marathi || ''}
                      onChange={(e) => handleSectionSelect(e.target.value)}
                    >
                      <option value="">Select or create section...</option>
                      {dbSections.map(s => (
                        <option key={s.id} value={s.name}>{s.name}</option>
                      ))}
                      {formData.section_title_marathi && !dbSections.find(s => s.name === formData.section_title_marathi) && (
                        <option value={formData.section_title_marathi}>{formData.section_title_marathi} (Custom)</option>
                      )}
                      <option value="__new__">+ Create New Section</option>
                      {formData.section_title_marathi && dbSections.find(s => s.name === formData.section_title_marathi) && (
                        <option value="__edit__">Edit Current Section</option>
                      )}
                    </select>
                  </div>
                ) : (
                  <div className="input-group">
                    <input
                      type="text"
                      className="form-control"
                      value={sectionInput}
                      onChange={(e) => setSectionInput(e.target.value)}
                      placeholder="Enter section name..."
                    />
                    <button
                      className="btn btn-success"
                      type="button"
                      onClick={handleSaveSection}
                      disabled={!sectionInput.trim()}
                    >
                      <i className="bi bi-check"></i> Save
                    </button>
                    <button
                      className="btn btn-secondary"
                      type="button"
                      onClick={() => {
                        setSectionMode('select');
                        setSectionInput('');
                        setEditingSection(null);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
              <div className="col-md-6">
                <label className="form-label">Is Active</label>
                <select
                  className="form-select"
                  value={formData.question_is_active}
                  onChange={(e) => updateField('question_is_active', parseInt(e.target.value))}
                >
                  <option value={1}>Active</option>
                  <option value={0}>Inactive</option>
                </select>
              </div>
            </div>

            <div className="row mb-3">
              <div className="col-md-6">
                <label className="form-label">Question (Marathi) *</label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={formData.question_marathi || ''}
                  onChange={(e) => updateField('question_marathi', e.target.value)}
                  required
                  placeholder="Enter question text in Marathi..."
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Question (English)</label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={formData.question_english || ''}
                  onChange={(e) => updateField('question_english', e.target.value || null)}
                  placeholder="Enter question text in English..."
                />
              </div>
            </div>

            <div className="row mb-3">
              <div className="col-md-4">
                <label className="form-label">Question Type *</label>
                <select
                  className="form-select"
                  value={formData.question_type}
                  onChange={(e) => updateField('question_type', e.target.value)}
                  required
                >
                  <option value="short_answer">short_answer</option>
                  <option value="long_answer">long_answer</option>
                  <option value="mcq">mcq</option>
                  <option value="date">date</option>
                  <option value="number">number</option>
                  <option value="yes_no">yes_no</option>
                  <option value="age">age</option>
                  <option value="gender">gender</option>
                  <option value="upload">upload</option>
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label">Is Required</label>
                <select
                  className="form-select"
                  value={formData.is_required}
                  onChange={(e) => updateField('is_required', parseInt(e.target.value))}
                >
                  <option value={1}>Yes</option>
                  <option value={0}>No</option>
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label">Question Sort Order</label>
                <input
                  type="number"
                  className="form-control"
                  value={formData.question_sort_order}
                  onChange={(e) => updateField('question_sort_order', parseInt(e.target.value) || 0)}
                />
              </div>
            </div>

            {(formData.question_type === 'mcq' || formData.question_type === 'upload') && (
              <div className="mb-3">
                <label className="form-label">
                  Options {formData.question_type === 'mcq' && '(comma-separated)'}
                </label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={formData.options || ''}
                  onChange={(e) => updateField('options', e.target.value || null)}
                  placeholder={formData.question_type === 'mcq' ? 'Option1,Option2,Option3' : 'Leave empty for upload'}
                />
              </div>
            )}

            {/* Regex Generator from Sample Value */}
            <div className="mb-3">
              <label className="form-label">Sample Value (for Regex Generation)</label>
              <div className="input-group">
                <input
                  type="text"
                  className="form-control"
                  value={sampleValue}
                  onChange={(e) => handleSampleValueChange(e.target.value)}
                  placeholder="e.g., AB1234567890123456 or 123456789012 or ABC1234567"
                />
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => {
                    if (formData.regex) {
                      setSampleValue('');
                      setGeneratedRegex('');
                      updateField('regex', null);
                    }
                  }}
                  title="Clear sample value"
                >
                  Clear
                </button>
              </div>
              <small className="text-muted">
                Enter a sample value and regex will be auto-generated. Examples:
                <br />
                • <code>AB1234567890123456</code> → <code>^[A-Z]{2}\d{16}$</code> (2 letters + 16 digits)
                <br />
                • <code>123456789012</code> → <code>^\d{12}$</code> (12 digits)
                <br />
                • <code>ABC1234567</code> → <code>^[A-Z]{3}\d{7}$</code> (3 letters + 7 digits)
                <br />
                • <code>1234-5678-9012</code> → <code>^\d{4}-\d{4}-\d{4}$</code> (with dashes)
              </small>
            </div>

            {/* Generated Regex (read-only, for reference) */}
            {generatedRegex && (
              <div className="mb-3">
                <label className="form-label">Generated Regex</label>
                <div className="input-group">
                  <input
                    type="text"
                    className="form-control font-monospace"
                    value={generatedRegex}
                    readOnly
                    style={{ backgroundColor: '#f8f9fa' }}
                  />
                  <button
                    type="button"
                    className="btn btn-outline-primary"
                    onClick={() => {
                      navigator.clipboard.writeText(generatedRegex);
                      alert('Regex copied to clipboard!');
                    }}
                    title="Copy regex"
                  >
                    📋 Copy
                  </button>
                </div>
                <small className="text-muted">This regex will be saved to the database</small>
              </div>
            )}

            {/* Manual Regex Override (optional) */}
            <div className="mb-3">
              <label className="form-label">Regex (Manual Override - Optional)</label>
              <input
                type="text"
                className="form-control font-monospace"
                value={formData.regex || ''}
                onChange={(e) => {
                  updateField('regex', e.target.value || null);
                  if (e.target.value) {
                    setGeneratedRegex(e.target.value);
                  }
                }}
                placeholder="Or enter regex manually (e.g., ^\\d{12}$)"
              />
              <small className="text-muted">
                You can manually override the generated regex if needed. Use <code>\\</code> for backslashes.
              </small>
            </div>

            {/* Valid Input and Max Length (auto-detected, but editable) */}
            <div className="row mb-3">
              <div className="col-md-6">
                <label className="form-label">Valid Input</label>
                <select
                  className="form-select"
                  value={formData.valid_input || ''}
                  onChange={(e) => updateField('valid_input', e.target.value || null)}
                >
                  <option value="">Select...</option>
                  <option value="text">text</option>
                  <option value="numeric">numeric</option>
                  <option value="alphanumeric">alphanumeric</option>
                </select>
                <small className="text-muted">Auto-detected from sample value</small>
              </div>
              <div className="col-md-6">
                <label className="form-label">Max Length</label>
                <input
                  type="number"
                  className="form-control"
                  value={formData.max_length || ''}
                  onChange={(e) => updateField('max_length', e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="Auto-detected from sample"
                  min="1"
                />
                <small className="text-muted">Auto-detected from sample value</small>
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label">Rendering Condition</label>
              <textarea
                className="form-control"
                rows={3}
                value={formData.rendering_condition || ''}
                onChange={(e) => updateField('rendering_condition', e.target.value || null)}
                placeholder="Enter conditional rendering logic (JSON or text)"
              />
              <small className="text-muted">Conditional rendering configuration (as stored in database)</small>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={() => onSave(formData)}>
              Save Question
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

