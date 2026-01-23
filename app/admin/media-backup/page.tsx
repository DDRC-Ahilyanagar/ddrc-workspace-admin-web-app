'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/AdminLayout';
import { getAbsoluteImageUrl } from '@/lib/config';

interface BackupFolder {
  folderName: string;
  officerName: string;
  mobileNo: string;
  imageCount: number;
  totalImages: number;
  images: Array<{ name: string; path: string }>;
}

const ITEMS_PER_PAGE = 10;

export default function MediaBackupPage() {
  const router = useRouter();
  const [folders, setFolders] = useState<BackupFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedFolder, setExpandedFolder] = useState<string | null>(null);
  const [selectedFolderImages, setSelectedFolderImages] = useState<Array<{ name: string; path: string }>>([]);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'folder' | 'image'; folderName: string; imageName?: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Client-side only state for Portals
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    loadFolders();
  }, []);

  // Keyboard navigation for lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!lightboxOpen) return;

      if (e.key === 'Escape') {
        setLightboxOpen(false);
      } else if (e.key === 'ArrowLeft') {
        setLightboxIndex((prev) => (prev > 0 ? prev - 1 : selectedFolderImages.length - 1));
      } else if (e.key === 'ArrowRight') {
        setLightboxIndex((prev) => (prev < selectedFolderImages.length - 1 ? prev + 1 : 0));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen, selectedFolderImages.length]);

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
      setCurrentPage(1); // Reset to first page on reload
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

  const openLightbox = (index: number) => {
    if (selectedFolderImages && selectedFolderImages.length > index) {
      const imgPath = selectedFolderImages[index].path;
      const fullUrl = getAbsoluteImageUrl(imgPath);
      console.log('Opening Lightbox for image:', { index, imgPath, fullUrl });

      setLightboxIndex(index);
      setImageLoading(true);
      setImageError(false);
      setLightboxOpen(true);
    }
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
  };

  const goToPrevious = () => {
    setImageLoading(true);
    setImageError(false);
    setLightboxIndex((prev) => (prev > 0 ? prev - 1 : selectedFolderImages.length - 1));
  };

  const goToNext = () => {
    setImageLoading(true);
    setImageError(false);
    setLightboxIndex((prev) => (prev < selectedFolderImages.length - 1 ? prev + 1 : 0));
  };

  const handleDeleteClick = (type: 'folder' | 'image', folderName: string, imageName?: string) => {
    setDeleteTarget({ type, folderName, imageName });
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      const params = new URLSearchParams({ folder: deleteTarget.folderName });
      if (deleteTarget.imageName) {
        params.append('image', deleteTarget.imageName);
      }

      const response = await fetch(`/api/admin/backup-folders?${params.toString()}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        alert(data.error || 'Failed to delete');
        return;
      }

      // Success - reload folders
      if (deleteTarget.type === 'folder') {
        // Folder deleted, collapse and reload
        setExpandedFolder(null);
        setSelectedFolderImages([]);
        await loadFolders();
      } else {
        // Image deleted, reload folder images
        const updatedImages = selectedFolderImages.filter(img => img.name !== deleteTarget.imageName);
        setSelectedFolderImages(updatedImages);

        // If no images left, reload folders to update count
        if (updatedImages.length === 0) {
          await loadFolders();
        }
      }

      setDeleteConfirmOpen(false);
      setDeleteTarget(null);
    } catch (err: any) {
      alert(err.message || 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  // Pagination logic
  const totalPages = Math.ceil(folders.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedFolders = folders.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    setCurrentPage(page);
    setExpandedFolder(null);
    setSelectedFolderImages([]);
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
          <>
            <div className="row mb-3">
              <div className="col-12">
                <div className="d-flex justify-content-between align-items-center">
                  <p className="text-muted mb-0">
                    Showing {startIndex + 1} to {Math.min(endIndex, folders.length)} of {folders.length} folders
                  </p>
                  {totalPages > 1 && (
                    <nav>
                      <ul className="pagination mb-0">
                        <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                          <button
                            className="page-link"
                            onClick={() => goToPage(currentPage - 1)}
                            disabled={currentPage === 1}
                          >
                            Previous
                          </button>
                        </li>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                          <li key={page} className={`page-item ${currentPage === page ? 'active' : ''}`}>
                            <button
                              className="page-link"
                              onClick={() => goToPage(page)}
                            >
                              {page}
                            </button>
                          </li>
                        ))}
                        <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                          <button
                            className="page-link"
                            onClick={() => goToPage(currentPage + 1)}
                            disabled={currentPage === totalPages}
                          >
                            Next
                          </button>
                        </li>
                      </ul>
                    </nav>
                  )}
                </div>
              </div>
            </div>

            <div className="row">
              <div className="col-12">
                <div className="card">
                  <div className="card-header">
                    <h5 className="mb-0">
                      <i className="bi bi-folder-fill me-2"></i>
                      Backup Folders (Page {currentPage} of {totalPages})
                    </h5>
                  </div>
                  <div className="card-body">
                    <div className="list-group">
                      {paginatedFolders.map((folder) => (
                        <div key={folder.folderName} className="list-group-item">
                          <div className="d-flex justify-content-between align-items-center">
                            <div
                              className="flex-grow-1 cursor-pointer"
                              onClick={() => handleFolderClick(folder.folderName)}
                              style={{ cursor: 'pointer' }}
                            >
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
                            <div className="d-flex align-items-center gap-2">
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteClick('folder', folder.folderName);
                                }}
                                title="Delete entire folder"
                              >
                                <i className="bi bi-trash"></i>
                              </button>
                              <i
                                className={`bi bi-chevron-${expandedFolder === folder.folderName ? 'up' : 'down'}`}
                                style={{ cursor: 'pointer' }}
                                onClick={() => handleFolderClick(folder.folderName)}
                              ></i>
                            </div>
                          </div>

                          {expandedFolder === folder.folderName && (
                            <div className="mt-3 pt-3 border-top">
                              <h6 className="mb-3">Images in this folder:</h6>
                              <div className="row g-2">
                                {selectedFolderImages.length > 0 ? (
                                  selectedFolderImages.map((image, idx) => (
                                    <div key={idx} className="col-6 col-sm-4 col-md-3 col-lg-2 col-xl-1">
                                      <div className="card h-100 position-relative">
                                        <button
                                          className="btn btn-sm btn-danger position-absolute top-0 end-0 m-1"
                                          style={{ zIndex: 10, padding: '2px 6px', fontSize: '0.75rem' }}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteClick('image', folder.folderName, image.name);
                                          }}
                                          title="Delete image"
                                        >
                                          <i className="bi bi-x"></i>
                                        </button>
                                        <div
                                          style={{ cursor: 'pointer' }}
                                          onClick={() => openLightbox(idx)}
                                        >
                                          <img
                                            src={getAbsoluteImageUrl(image.path)}
                                            alt={image.name}
                                            className="card-img-top"
                                            style={{
                                              height: '120px',
                                              objectFit: 'cover',
                                            }}
                                            onError={(e) => {
                                              (e.target as HTMLImageElement).src = '/placeholder-image.png';
                                            }}
                                          />
                                          <div className="card-body p-1">
                                            <p className="card-text small mb-0 text-truncate" title={image.name} style={{ fontSize: '0.7rem' }}>
                                              {image.name}
                                            </p>
                                          </div>
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

            {/* Pagination at bottom */}
            {totalPages > 1 && (
              <div className="row mt-3">
                <div className="col-12">
                  <nav>
                    <ul className="pagination justify-content-center">
                      <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                        <button
                          className="page-link"
                          onClick={() => goToPage(currentPage - 1)}
                          disabled={currentPage === 1}
                        >
                          Previous
                        </button>
                      </li>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                        <li key={page} className={`page-item ${currentPage === page ? 'active' : ''}`}>
                          <button
                            className="page-link"
                            onClick={() => goToPage(page)}
                          >
                            {page}
                          </button>
                        </li>
                      ))}
                      <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                        <button
                          className="page-link"
                          onClick={() => goToPage(currentPage + 1)}
                          disabled={currentPage === totalPages}
                        >
                          Next
                        </button>
                      </li>
                    </ul>
                  </nav>
                </div>
              </div>
            )}
          </>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirmOpen && deleteTarget && (
          <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Confirm Delete</h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setDeleteConfirmOpen(false)}
                    disabled={deleting}
                  ></button>
                </div>
                <div className="modal-body">
                  <p>
                    {deleteTarget.type === 'folder'
                      ? `Are you sure you want to delete the entire folder "${deleteTarget.folderName}" and all its images? This action cannot be undone.`
                      : `Are you sure you want to delete the image "${deleteTarget.imageName}"? This action cannot be undone.`}
                  </p>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setDeleteConfirmOpen(false)}
                    disabled={deleting}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={confirmDelete}
                    disabled={deleting}
                  >
                    {deleting ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Deleting...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-trash me-2"></i>
                        Delete
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Lightbox Modal rendered via Portal to ensure it covers Sidebar & TopNav */}
        {isClient && lightboxOpen && selectedFolderImages.length > 0 && selectedFolderImages[lightboxIndex] && createPortal(
          <div
            className="lightbox-master-overlay"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              backgroundColor: 'rgba(0, 0, 0, 0.95)',
              zIndex: 2147483647, // Max integer for z-index
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden'
            }}
            onClick={closeLightbox}
          >
            {/* Header / Top Bar */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                padding: '20px 30px',
                display: 'flex',
                justifyContent: 'between',
                alignItems: 'center',
                background: 'linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, transparent 100%)',
                zIndex: 10
              }}
              className="d-flex justify-content-between align-items-center w-100"
            >
              <div className="text-white">
                <h5 className="mb-0">{selectedFolderImages[lightboxIndex].name}</h5>
                <small className="text-white-50">{lightboxIndex + 1} of {selectedFolderImages.length}</small>
              </div>

              <div className="d-flex align-items-center gap-3">
                <a
                  href={getAbsoluteImageUrl(selectedFolderImages[lightboxIndex].path)}
                  download={selectedFolderImages[lightboxIndex].name}
                  className="btn btn-outline-light btn-sm rounded-pill px-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <i className="bi bi-download me-2"></i> Download
                </a>
                <button
                  className="btn-close btn-close-white"
                  onClick={closeLightbox}
                  style={{ fontSize: '1.5rem', cursor: 'pointer' }}
                ></button>
              </div>
            </div>

            {/* Navigation - Left */}
            <button
              className="btn btn-dark rounded-circle d-flex align-items-center justify-content-center p-0"
              style={{
                position: 'absolute',
                left: '20px',
                width: '60px',
                height: '60px',
                zIndex: 20,
                border: '1px solid rgba(255,255,255,0.2)'
              }}
              onClick={(e) => { e.stopPropagation(); goToPrevious(); }}
            >
              <i className="bi bi-chevron-left" style={{ fontSize: '2rem' }}></i>
            </button>

            {/* Image Container */}
            <div
              className="d-flex align-items-center justify-content-center"
              style={{ width: '100%', height: '100%', padding: '80px' }}
              onClick={(e) => e.stopPropagation()}
            >
              {imageLoading && !imageError && (
                <div className="text-center text-white position-absolute">
                  <div className="spinner-border text-primary mb-2" style={{ width: '3rem', height: '3rem' }}></div>
                  <p>Loading Image...</p>
                </div>
              )}

              {imageError ? (
                <div className="text-center text-white bg-dark p-5 rounded border border-secondary shadow">
                  <i className="bi bi-exclamation-triangle text-warning display-1 mb-3"></i>
                  <h3>Unable to load image</h3>
                  <p className="text-muted">The file might be corrupted or inaccessible.</p>
                  <div className="d-flex gap-2 justify-content-center mt-4">
                    <button className="btn btn-primary" onClick={() => { setImageError(false); setImageLoading(true); }}>Retry</button>
                    <button className="btn btn-secondary" onClick={closeLightbox}>Close</button>
                  </div>
                </div>
              ) : (
                <img
                  src={getAbsoluteImageUrl(selectedFolderImages[lightboxIndex].path)}
                  alt={selectedFolderImages[lightboxIndex].name}
                  onLoad={() => setImageLoading(false)}
                  onError={() => { setImageLoading(false); setImageError(true); }}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                    border: '4px solid white',
                    boxShadow: '0 0 50px rgba(0,0,0,1)',
                    display: imageLoading ? 'none' : 'block'
                  }}
                />
              )}
            </div>

            {/* Navigation - Right */}
            <button
              className="btn btn-dark rounded-circle d-flex align-items-center justify-content-center p-0"
              style={{
                position: 'absolute',
                right: '20px',
                width: '60px',
                height: '60px',
                zIndex: 20,
                border: '1px solid rgba(255,255,255,0.2)'
              }}
              onClick={(e) => { e.stopPropagation(); goToNext(); }}
            >
              <i className="bi bi-chevron-right" style={{ fontSize: '2rem' }}></i>
            </button>

            {/* Footer / Info */}
            <div className="position-absolute bottom-0 w-100 text-center pb-4" style={{ pointerEvents: 'none' }}>
              <span className="badge bg-dark bg-opacity-75 rounded-pill px-4 py-2 text-white-50">
                Use Arrow Keys to navigate • ESC to close
              </span>
            </div>
          </div>,
          document.body
        )}
      </div>
    </AdminLayout>
  );
}
