'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AdminLayout from '@/components/AdminLayout';

interface FieldOfficerProfile {
  profilePhoto: string | null;
  taluka: string | null;
  primaryGaav: string | null;
  additionalGaavs: string[];
  accountHolderName: string | null;
  accountNumber: string | null;
  bankName: string | null;
  ifscCode: string | null;
  upiId: string | null;
  qrCode: string | null;
  profileComplete: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

interface OfficerProfile {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  status: string | null;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  lastLogin: string | null;
  profile: FieldOfficerProfile | null;
  statistics: {
    completedSurveys: number;
    incompleteSurveys: number;
    totalSurveys: number;
    walletBalance: string;
    ratePerSurvey: number;
  };
}

export default function OfficerProfilePage() {
  const params = useParams();
  const router = useRouter();
  const officerId = params.id as string;
  
  const [profile, setProfile] = useState<OfficerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (officerId) {
      fetchProfile();
    }
  }, [officerId]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/admin/officers/${officerId}`);
      const json = await res.json();
      
      if (json.ok) {
        setProfile(json.data);
      } else {
        setError(json.error || 'Failed to load profile');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch profile');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="container-fluid">
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-2 text-muted">Loading profile...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error || !profile) {
    return (
      <AdminLayout>
        <div className="container-fluid">
          <div className="alert alert-danger">
            <i className="bi bi-exclamation-triangle me-2"></i>
            {error || 'Profile not found'}
          </div>
          <button className="btn btn-secondary" onClick={() => router.push('/officers')}>
            <i className="bi bi-arrow-left me-2"></i>
            Back to Officers List
          </button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="container-fluid">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <button 
              className="btn btn-outline-secondary mb-2"
              onClick={() => router.push('/officers')}
            >
              <i className="bi bi-arrow-left me-2"></i>
              Back to Officers List
            </button>
            <h1 className="h3 mb-0">Field Officer Profile</h1>
          </div>
          <button
            className="btn btn-primary"
            onClick={fetchProfile}
          >
            <i className="bi bi-arrow-clockwise me-2"></i>
            Refresh
          </button>
        </div>

        <div className="row">
          {/* Left Column - Profile Photo and Basic Info */}
          <div className="col-md-4 mb-4">
            <div className="card">
              <div className="card-body text-center">
                {profile.profile?.profilePhoto ? (
                  <img
                    src={profile.profile.profilePhoto}
                    alt={profile.name}
                    className="img-fluid rounded-circle mb-3"
                    style={{ width: '200px', height: '200px', objectFit: 'cover' }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/images/default-avatar.png';
                    }}
                  />
                ) : (
                  <div 
                    className="rounded-circle bg-secondary d-inline-flex align-items-center justify-content-center mb-3"
                    style={{ width: '200px', height: '200px' }}
                  >
                    <i className="bi bi-person" style={{ fontSize: '5rem', color: 'white' }}></i>
                  </div>
                )}
                <h4 className="mb-1">{profile.name}</h4>
                <p className="text-muted mb-3">
                  {profile.profile?.profileComplete ? (
                    <span className="badge bg-success">Profile Complete</span>
                  ) : (
                    <span className="badge bg-warning text-dark">Profile Incomplete</span>
                  )}
                </p>
                
                <div className="text-start">
                  <div className="mb-2">
                    <strong>Phone:</strong> {profile.phone || '-'}
                  </div>
                  <div className="mb-2">
                    <strong>Email:</strong> {profile.email || '-'}
                  </div>
                  <div className="mb-2">
                    <strong>Status:</strong>{' '}
                    <span className={`badge ${profile.isActive ? 'bg-success' : 'bg-danger'}`}>
                      {profile.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="mb-2">
                    <strong>Last Login:</strong> {formatDate(profile.lastLogin)}
                  </div>
                </div>
              </div>
            </div>

            {/* Statistics Card */}
            <div className="card mt-3">
              <div className="card-header">
                <h5 className="mb-0">Statistics</h5>
              </div>
              <div className="card-body">
                <div className="mb-3">
                  <div className="d-flex justify-content-between">
                    <span>Completed Surveys:</span>
                    <strong className="text-success">{profile.statistics.completedSurveys}</strong>
                  </div>
                </div>
                <div className="mb-3">
                  <div className="d-flex justify-content-between">
                    <span>Incomplete Surveys:</span>
                    <strong className="text-warning">{profile.statistics.incompleteSurveys}</strong>
                  </div>
                </div>
                <div className="mb-3">
                  <div className="d-flex justify-content-between">
                    <span>Total Surveys:</span>
                    <strong>{profile.statistics.totalSurveys}</strong>
                  </div>
                </div>
                <hr />
                <div className="mb-2">
                  <div className="d-flex justify-content-between">
                    <span>Wallet Balance:</span>
                    <strong className="text-success">
                      ₹{parseFloat(profile.statistics.walletBalance).toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </strong>
                  </div>
                </div>
                <div className="text-muted small">
                  Rate: ₹{profile.statistics.ratePerSurvey.toFixed(2)} per survey
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Detailed Information */}
          <div className="col-md-8">
            {/* Territory Information */}
            <div className="card mb-4">
              <div className="card-header">
                <h5 className="mb-0">
                  <i className="bi bi-geo-alt me-2"></i>
                  Territory Information
                </h5>
              </div>
              <div className="card-body">
                <div className="row mb-3">
                  <div className="col-md-6">
                    <strong>Taluka:</strong>
                    <p>{profile.profile?.taluka || '-'}</p>
                  </div>
                  <div className="col-md-6">
                    <strong>Primary Village (Gaav):</strong>
                    <p>{profile.profile?.primaryGaav || '-'}</p>
                  </div>
                </div>
                {profile.profile?.additionalGaavs && profile.profile.additionalGaavs.length > 0 && (
                  <div>
                    <strong>Additional Villages (Gaavs):</strong>
                    <ul className="mt-2">
                      {profile.profile.additionalGaavs.map((gaav, index) => (
                        <li key={index}>{gaav}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Bank Details */}
            <div className="card mb-4">
              <div className="card-header">
                <h5 className="mb-0">
                  <i className="bi bi-bank me-2"></i>
                  Bank Details
                </h5>
              </div>
              <div className="card-body">
                <div className="row mb-3">
                  <div className="col-md-6">
                    <strong>Account Holder Name:</strong>
                    <p>{profile.profile?.accountHolderName || '-'}</p>
                  </div>
                  <div className="col-md-6">
                    <strong>Account Number:</strong>
                    <p>{profile.profile?.accountNumber ? '****' + profile.profile.accountNumber.slice(-4) : '-'}</p>
                  </div>
                </div>
                <div className="row mb-3">
                  <div className="col-md-6">
                    <strong>Bank Name:</strong>
                    <p>{profile.profile?.bankName || '-'}</p>
                  </div>
                  <div className="col-md-6">
                    <strong>IFSC Code:</strong>
                    <p>{profile.profile?.ifscCode || '-'}</p>
                  </div>
                </div>
                <div className="row">
                  <div className="col-md-6">
                    <strong>UPI ID:</strong>
                    <p>{profile.profile?.upiId || '-'}</p>
                  </div>
                  <div className="col-md-6">
                    <strong>QR Code:</strong>
                    {profile.profile?.qrCode ? (
                      <div>
                        <img
                          src={profile.profile.qrCode}
                          alt="QR Code"
                          className="img-thumbnail"
                          style={{ maxWidth: '150px', maxHeight: '150px' }}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            (e.target as HTMLImageElement).nextElementSibling?.classList.remove('d-none');
                          }}
                        />
                        <span className="d-none text-muted">QR Code image not available</span>
                      </div>
                    ) : (
                      <p>-</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Account Information */}
            <div className="card">
              <div className="card-header">
                <h5 className="mb-0">
                  <i className="bi bi-info-circle me-2"></i>
                  Account Information
                </h5>
              </div>
              <div className="card-body">
                <div className="row mb-3">
                  <div className="col-md-6">
                    <strong>User ID:</strong>
                    <p className="font-monospace">{profile.id}</p>
                  </div>
                  <div className="col-md-6">
                    <strong>Account Status:</strong>
                    <p>
                      <span className={`badge ${profile.isActive ? 'bg-success' : 'bg-danger'}`}>
                        {profile.isActive ? 'Active' : 'Inactive'}
                      </span>
                      {profile.status && (
                        <span className="badge bg-secondary ms-2">{profile.status}</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="row">
                  <div className="col-md-6">
                    <strong>Created At:</strong>
                    <p>{formatDate(profile.createdAt)}</p>
                  </div>
                  <div className="col-md-6">
                    <strong>Last Updated:</strong>
                    <p>{formatDate(profile.updatedAt)}</p>
                  </div>
                </div>
                {profile.profile && (
                  <div className="row mt-3">
                    <div className="col-md-6">
                      <strong>Profile Created:</strong>
                      <p>{formatDate(profile.profile.createdAt)}</p>
                    </div>
                    <div className="col-md-6">
                      <strong>Profile Updated:</strong>
                      <p>{formatDate(profile.profile.updatedAt)}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
