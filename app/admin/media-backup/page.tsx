'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/AdminLayout';

interface BackupFolder {
  folderName: string;
  officerName: string;
  mobileNo: string;
  imageCount: number;
  totalImages: number;
  images: Array<{ name: string; path: string }>;
}

export default function MediaBackupPage() {
  const router = useRouter();
  const [folders, setFolders] = useState<BackupFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedFolder, setExpandedFolder] = useState<string | null>(null);
  const [selectedFolderImages, setSelectedFolderImages] = useState<Array<{ name: string; path: string }>>([]);

  useEffect(() => {
    loadFolders();
  }, []);

  const loadFolders = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/backup-folders', {
        cache: 'no-store',
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        if (response.status === 403) {
          setError('Access denied. This page is only accessible to authorized admin users.');
          setTimeout(() => router.push('/dashboard'), 3000);
        } else {
          setError(data.error || 'Failed to load backup folders');
        }
        return;
      }

      setFolders(data.folders || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load backup folders');
    } finally {
      setLoading(false);
    }
  };

  const handleFolderClick = async (folderName: string) => {
    if (expandedFolder === folderName) {
      setExpandedFolder(null);
      setSelectedFolderImages([]);
      return;
    }

    setExpandedFolder(folderName);
    setSelectedFolderImages([]); // Clear previous images
    
    // Load all images for this folder
    try {
      const response = await fetch(`/api/admin/backup-folders?folder=${encodeURIComponent(folderName)}`, {
        cache: 'no-store',
      });
      const data = await response.json();
      
      if (data.ok && data.folderImages && Array.isArray(data.folderImages)) {
        setSelectedFolderImages(data.folderImages);
      } else {
        // Fallback: use images from folder data
        const folder = folders.find(f => f.folderName === folderName);
        if (folder) {
          setSelectedFolderImages(folder.images);
        }
      }
    } catch (err) {
      console.error('Error loading folder images:', err);
      // Fallback: use images from folder data
      const folder = folders.find(f => f.folderName === folderName);
      if (folder) {
        setSelectedFolderImages(folder.images);
      }
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="container-fluid">
          <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
            <div className="text-center">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <p className="mt-3">Loading media backups...</p>
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="container-fluid">
          <div className="alert alert-danger" role="alert">
            <h4 className="alert-heading">Error</h4>
            <p>{error}</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="container-fluid">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h1 className="title mb-0">Media Backup - Field Officer Images</h1>
          <button
            className="btn btn-primary"
            onClick={loadFolders}
            disabled={loading}
          >
            <i className="bi bi-arrow-clockwise me-2"></i>
            Refresh
          </button>
        </div>

        {folders.length === 0 ? (
          <div className="alert alert-info" role="alert">
            <h5>No Backup Folders Found</h5>
            <p className="mb-0">No media backups are available at this time.</p>
          </div>
        ) : (
          <div className="row">
            <div className="col-12">
              <div className="card">
                <div className="card-header">
                  <h5 className="mb-0">
                    <i className="bi bi-folder-fill me-2"></i>
                    Backup Folders ({folders.length})
                  </h5>
                </div>
                <div className="card-body">
                  <div className="list-group">
                    {folders.map((folder) => (
                      <div key={folder.folderName} className="list-group-item">
                        <div
                          className="d-flex justify-content-between align-items-center cursor-pointer"
                          onClick={() => handleFolderClick(folder.folderName)}
                          style={{ cursor: 'pointer' }}
                        >
                          <div className="flex-grow-1">
                            <h6 className="mb-1">
                              <i className="bi bi-folder me-2"></i>
                              {folder.officerName}
                            </h6>
                            <p className="mb-1 text-muted small">
                              <i className="bi bi-telephone me-1"></i>
                              {folder.mobileNo}
                            </p>
                            <p className="mb-0 text-muted small">
                              <i className="bi bi-images me-1"></i>
                              {folder.totalImages} image{folder.totalImages !== 1 ? 's' : ''}
                            </p>
                          </div>
                          <div>
                            <i
                              className={`bi bi-chevron-${expandedFolder === folder.folderName ? 'up' : 'down'}`}
                            ></i>
                          </div>
                        </div>

                        {expandedFolder === folder.folderName && (
                          <div className="mt-3 pt-3 border-top">
                            <h6 className="mb-3">Images in this folder:</h6>
                            <div className="row g-2">
                              {selectedFolderImages.length > 0 ? (
                                selectedFolderImages.map((image, idx) => (
                                  <div key={idx} className="col-6 col-md-4 col-lg-3">
                                    <div className="card">
                                      <img
                                        src={image.path}
                                        alt={image.name}
                                        className="card-img-top"
                                        style={{
                                          height: '200px',
                                          objectFit: 'cover',
                                          cursor: 'pointer',
                                        }}
                                        onClick={() => window.open(image.path, '_blank')}
                                        onError={(e) => {
                                          (e.target as HTMLImageElement).src = '/placeholder-image.png';
                                        }}
                                      />
                                      <div className="card-body p-2">
                                        <p className="card-text small mb-0 text-truncate" title={image.name}>
                                          {image.name}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div className="col-12">
                                  <p className="text-muted">Loading images...</p>
                                </div>
                              )}
                            </div>
                            {selectedFolderImages.length < folder.totalImages && (
                              <div className="mt-3 text-center">
                                <p className="text-muted small">
                                  Showing {selectedFolderImages.length} of {folder.totalImages} images
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

