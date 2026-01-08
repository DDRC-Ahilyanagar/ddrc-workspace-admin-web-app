'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/AdminLayout';

interface ImportResult {
  processed: number;
  errors: number;
  errorDetails?: string[];
  data?: any[];
}

export default function ExcelImportPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');
  const [userType, setUserType] = useState('');

  useEffect(() => {
    const loggedIn = localStorage.getItem('logged_in');
    const storedUserType = localStorage.getItem('user_type') || '';
    setUserType(storedUserType);

    if (!loggedIn || loggedIn !== 'true') {
      router.push('/login');
      return;
    }

    // Check if user is verification officer or admin
    const isVerificationOfficer = storedUserType.toLowerCase().trim() === 'verification_officer';
    const isAdmin = storedUserType.toLowerCase().trim() === 'admin';

    if (!isVerificationOfficer && !isAdmin) {
      router.push('/dashboard');
    }
  }, [router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setImportResult(null);
      setError('');
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch('/api/verification-officer/export-template');
      if (!response.ok) {
        throw new Error('Template download unsuccessful. Please try again.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'divyang_data_template.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setError('Template download unsuccessful: ' + err.message + '. Please try again.');
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select an Excel file to upload.');
      return;
    }

    setUploading(true);
    setError('');
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/verification-officer/import-excel', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.ok) {
        setImportResult({
          processed: data.processed || 0,
          errors: data.errors || 0,
          errorDetails: data.errorDetails,
          data: data.data,
        });
      } else {
        setError(data.error || 'Excel file import unsuccessful. Please verify the file format and try again.');
      }
    } catch (err: any) {
      setError('File upload unsuccessful: ' + err.message + '. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="container-fluid">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h1 className="title mb-0">Excel Import/Export</h1>
          <button
            className="btn btn-outline-primary"
            onClick={handleDownloadTemplate}
          >
            <i className="bi bi-download me-2"></i>
            Download Template
          </button>
        </div>

        <div className="row">
          <div className="col-12 col-lg-8">
            <div className="card">
              <div className="card-header">
                <h5 className="card-title mb-0">Import Excel File</h5>
              </div>
              <div className="card-body">
                <div className="mb-3">
                  <label className="form-label">Select Excel File</label>
                  <input
                    type="file"
                    className="form-control"
                    accept=".xlsx,.xls"
                    onChange={handleFileChange}
                    disabled={uploading}
                  />
                  <small className="form-text text-muted">
                    Upload Excel file with Name, Aadhaar Number, Village, Taluka, and other fields matching the template.
                  </small>
                </div>

                {file && (
                  <div className="alert alert-info">
                    <i className="bi bi-file-earmark-excel me-2"></i>
                    Selected file: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(2)} KB)
                  </div>
                )}

                {error && (
                  <div className="alert alert-danger" role="alert">
                    {error}
                  </div>
                )}

                {importResult && (
                  <div className="alert alert-success" role="alert">
                    <h6 className="alert-heading">Import Completed!</h6>
                    <p className="mb-0">
                      <strong>{importResult.processed}</strong> records processed successfully.
                      {importResult.errors > 0 && (
                        <span className="text-warning">
                          {' '}
                          <strong>{importResult.errors}</strong> errors occurred.
                        </span>
                      )}
                    </p>
                    {importResult.errorDetails && importResult.errorDetails.length > 0 && (
                      <details className="mt-2">
                        <summary>Error Details</summary>
                        <ul className="mb-0 mt-2">
                          {importResult.errorDetails.map((err, idx) => (
                            <li key={idx} className="small">{err}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                )}

                <button
                  className="btn btn-primary"
                  onClick={handleUpload}
                  disabled={!file || uploading}
                >
                  {uploading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                      Uploading...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-upload me-2"></i>
                      Upload & Import
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="col-12 col-lg-4">
            <div className="card">
              <div className="card-header">
                <h5 className="card-title mb-0">Instructions</h5>
              </div>
              <div className="card-body">
                <h6>Excel Template Columns:</h6>
                <ul className="small">
                  <li>Name (नाव)</li>
                  <li>Aadhaar Number (आधार कार्ड नंबर)</li>
                  <li>Village (गाव)</li>
                  <li>Taluka (तालुका)</li>
                  <li>Gram (ग्राम)</li>
                  <li>Disability Type (दिव्यांगता प्रकार)</li>
                  <li>Disability Percentage (दिव्यांगता टक्केवारी)</li>
                  <li>UDID Card (UDID कार्ड)</li>
                  <li>Phone Number (मोबाइल नंबर)</li>
                  <li>Email (ईमेल)</li>
                  <li>Date of Birth (जन्मतारीख)</li>
                  <li>Gender (लिंग)</li>
                </ul>
                <p className="small text-muted mb-0">
                  <strong>Note:</strong> Data will be distributed to respective village ASHA workers (field officers) based on village name.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}




