'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface AadhaarInfo {
  aadhaar?: string;
  name?: string;
  dob?: string;
  age?: string;
  gender?: string;
  address?: string;
}

export default function PublicFormPage() {
  const router = useRouter();
  const [step, setStep] = useState<'upload' | 'form'>('upload');
  const [frontImage, setFrontImage] = useState<File | null>(null);
  const [backImage, setBackImage] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string>('');
  const [backPreview, setBackPreview] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [aadhaarInfo, setAadhaarInfo] = useState<AadhaarInfo | null>(null);
  const [error, setError] = useState<string>('');
  const [aadharId, setAadharId] = useState<number | null>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>, side: 'front' | 'back') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('कृपया एक वैध प्रतिमा फाइल निवडा');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('प्रतिमा आकार 10MB पेक्षा जास्त नसावा');
      return;
    }

    if (side === 'front') {
      setFrontImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setFrontPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setBackImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setBackPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
    setError('');
  };

  const uploadImages = async () => {
    if (!frontImage || !backImage) {
      setError('कृपया आधार कार्डची दोन्ही बाजू अपलोड करा');
      return;
    }

    setUploading(true);
    setError('');

    try {
      // Upload front image
      const frontFormData = new FormData();
      frontFormData.append('files', frontImage);
      const frontRes = await fetch('/api/upload', {
        method: 'POST',
        body: frontFormData,
      });
      const frontData = await frontRes.json();
      if (!frontData.ok || !frontData.url) {
        throw new Error('Front image upload failed');
      }

      // Upload back image
      const backFormData = new FormData();
      backFormData.append('files', backImage);
      const backRes = await fetch('/api/upload', {
        method: 'POST',
        body: backFormData,
      });
      const backData = await backRes.json();
      if (!backData.ok || !backData.url) {
        throw new Error('Back image upload failed');
      }

      // Create Aadhaar record
      const createRes = await fetch('/api/create-aadhar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aadhar_no: '000000000000', // Placeholder, will be updated after OCR
          front_image: frontData.url,
          back_image: backData.url,
        }),
      });
      const createData = await createRes.json();
      if (!createData.ok || !createData.aadhar_id) {
        throw new Error('Failed to create Aadhaar record');
      }

      setAadharId(createData.aadhar_id);

      // Perform OCR
      setProcessing(true);
      const ocrFormData = new FormData();
      ocrFormData.append('front_image', frontImage);
      ocrFormData.append('back_image', backImage);
      ocrFormData.append('card_type', 'aadhaar');
      ocrFormData.append('aadhar_id', String(createData.aadhar_id));

      const ocrRes = await fetch('/api/public-ocr', {
        method: 'POST',
        body: ocrFormData,
      });
      const ocrData = await ocrRes.json();

      if (!ocrData.ok) {
        throw new Error(ocrData.error || 'OCR processing failed');
      }

      if (ocrData.aadhaar_info) {
        setAadhaarInfo(ocrData.aadhaar_info);
        // Extract and clean Aadhaar number (digits only)
        let aadhaarNumber = '';
        if (ocrData.aadhaar_info.aadhaar) {
          aadhaarNumber = ocrData.aadhaar_info.aadhaar.replace(/\D/g, '');
          // Update Aadhaar number in database
          await fetch('/api/create-aadhar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              aadhar_no: aadhaarNumber,
              front_image: frontData.url,
              back_image: backData.url,
            }),
          });
        }
        
        // Store Aadhaar info including cleaned number for form prefilling
        const aadhaarInfoForForm = {
          ...ocrData.aadhaar_info,
          aadhaar: aadhaarNumber, // Store cleaned number
        };
        sessionStorage.setItem('public_aadhaar_info', JSON.stringify(aadhaarInfoForForm));
      }

      // Move to form step
      setStep('form');
    } catch (err: any) {
      setError(err.message || 'अपलोड करताना त्रुटी आली');
    } finally {
      setUploading(false);
      setProcessing(false);
    }
  };

  return (
    <div className="gradient-bg min-vh-100 d-flex align-items-center justify-content-center py-5">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-lg-8 col-md-10">
            <div className="card shadow-lg border-0">
              <div className="card-header bg-primary text-white text-center py-4">
                <h2 className="mb-0">दिव्यांग सर्वेक्षण फॉर्म</h2>
                <p className="mb-0 mt-2">Divyang Survey Form</p>
              </div>
              <div className="card-body p-4">
                {step === 'upload' ? (
                  <div>
                    <div className="text-center mb-4">
                      <div className="alert alert-warning mb-3">
                        <i className="bi bi-exclamation-triangle-fill me-2"></i>
                        <strong>महत्वाचे:</strong> कृपया प्रथम आधार कार्ड अपलोड करा. हे सर्वात महत्वाचे पाऊल आहे.
                      </div>
                      <h4 className="mb-3">📄 आधार कार्ड अपलोड करा (अनिवार्य)</h4>
                      <p className="text-muted">कृपया आधार कार्डची दोन्ही बाजू (पुढील आणि मागील) अपलोड करा. OCR द्वारे आधार नंबर स्वयंचलितपणे भरला जाईल.</p>
                    </div>

                    {error && (
                      <div className="alert alert-danger" role="alert">
                        {error}
                      </div>
                    )}

                    <div className="row g-4">
                      {/* Front Image Upload */}
                      <div className="col-md-6">
                        <label className="form-label fw-bold">
                          आधार कार्ड - पुढील बाजू <span className="text-danger">*</span>
                        </label>
                        <div className="border rounded p-3 text-center" style={{ minHeight: '200px', backgroundColor: '#f8f9fa' }}>
                          {frontPreview ? (
                            <img
                              src={frontPreview}
                              alt="Front preview"
                              className="img-fluid rounded"
                              style={{ maxHeight: '200px' }}
                            />
                          ) : (
                            <div className="d-flex flex-column align-items-center justify-content-center h-100">
                              <i className="bi bi-cloud-upload fs-1 text-muted mb-2"></i>
                              <p className="text-muted mb-0">प्रतिमा निवडा</p>
                            </div>
                          )}
                        </div>
                        <input
                          type="file"
                          className="form-control mt-2"
                          accept="image/*"
                          onChange={(e) => handleImageSelect(e, 'front')}
                          disabled={uploading || processing}
                        />
                      </div>

                      {/* Back Image Upload */}
                      <div className="col-md-6">
                        <label className="form-label fw-bold">
                          आधार कार्ड - मागील बाजू <span className="text-danger">*</span>
                        </label>
                        <div className="border rounded p-3 text-center" style={{ minHeight: '200px', backgroundColor: '#f8f9fa' }}>
                          {backPreview ? (
                            <img
                              src={backPreview}
                              alt="Back preview"
                              className="img-fluid rounded"
                              style={{ maxHeight: '200px' }}
                            />
                          ) : (
                            <div className="d-flex flex-column align-items-center justify-content-center h-100">
                              <i className="bi bi-cloud-upload fs-1 text-muted mb-2"></i>
                              <p className="text-muted mb-0">प्रतिमा निवडा</p>
                            </div>
                          )}
                        </div>
                        <input
                          type="file"
                          className="form-control mt-2"
                          accept="image/*"
                          onChange={(e) => handleImageSelect(e, 'back')}
                          disabled={uploading || processing}
                        />
                      </div>
                    </div>

                    <div className="text-center mt-4">
                      <button
                        className="btn btn-primary btn-lg px-5"
                        onClick={uploadImages}
                        disabled={!frontImage || !backImage || uploading || processing}
                      >
                        {processing ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                            OCR प्रक्रिया करत आहे...
                          </>
                        ) : uploading ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                            अपलोड करत आहे...
                          </>
                        ) : (
                          'फॉर्म भरा / Fill the Form'
                        )}
                      </button>
                    </div>

                    {aadhaarInfo && (
                      <div className="alert alert-info mt-3">
                        <strong>OCR मधून मिळालेली माहिती:</strong>
                        <ul className="mb-0 mt-2">
                          {aadhaarInfo.name && <li>नाव: {aadhaarInfo.name}</li>}
                          {aadhaarInfo.aadhaar && <li>आधार नंबर: {aadhaarInfo.aadhaar}</li>}
                          {aadhaarInfo.dob && <li>जन्म तारीख: {aadhaarInfo.dob}</li>}
                          {aadhaarInfo.gender && <li>लिंग: {aadhaarInfo.gender}</li>}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className="alert alert-success">
                      <strong>✓ आधार कार्ड अपलोड केले आणि OCR प्रक्रिया पूर्ण झाली!</strong>
                      {aadhaarInfo && (
                        <div className="mt-3">
                          <p className="mb-2"><strong>OCR मधून मिळालेली माहिती:</strong></p>
                          <ul className="mb-0">
                            {aadhaarInfo.name && <li>नाव: {aadhaarInfo.name}</li>}
                            {aadhaarInfo.aadhaar && <li>आधार नंबर: {aadhaarInfo.aadhaar}</li>}
                            {aadhaarInfo.dob && <li>जन्म तारीख: {aadhaarInfo.dob}</li>}
                            {aadhaarInfo.gender && <li>लिंग: {aadhaarInfo.gender}</li>}
                            {aadhaarInfo.address && <li>पत्ता: {aadhaarInfo.address.substring(0, 100)}...</li>}
                          </ul>
                        </div>
                      )}
                    </div>
                    <div className="text-center mt-4">
                      <p className="mb-3">आपला आधार कार्ड यशस्वीरित्या अपलोड झाला आहे. आता आपण सर्वेक्षण फॉर्म भरू शकता.</p>
                      <button
                        className="btn btn-success btn-lg px-5"
                        onClick={() => {
                          // Store aadhar_id in sessionStorage for form submission
                          if (aadharId) {
                            sessionStorage.setItem('public_aadhar_id', String(aadharId));
                            sessionStorage.setItem('public_aadhaar_info', JSON.stringify(aadhaarInfo));
                          }
                          router.push(`/public-survey-form?aadhar_id=${aadharId}`);
                        }}
                      >
                        सर्वेक्षण फॉर्म भरा / Fill Survey Form
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

