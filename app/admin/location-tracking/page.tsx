'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/AdminLayout';

interface Location {
  user_id: number;
  name: string;
  contact_number: string;
  latitude: number | null;
  longitude: number | null;
  accuracy?: number;
  altitude?: number;
  speed?: number;
  heading?: number;
  timestamp: string | null;
  created_at: string | null;
  is_online: number; // 1 for online, 0 for offline
  last_online?: string | null; // Last time user was online
}

export default function LocationTrackingPage() {
  const router = useRouter();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [userType, setUserType] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const selectedLocationRef = useRef<Location | null>(null);
  const isInitialLoad = useRef(true);
  const isPolling = useRef(false); // Track if we're currently polling
  
  // Keep ref in sync with state
  useEffect(() => {
    selectedLocationRef.current = selectedLocation;
  }, [selectedLocation]);

  useEffect(() => {
    const loggedIn = localStorage.getItem('logged_in');
    const storedUserType = localStorage.getItem('user_type') || '';
    setUserType(storedUserType);

    if (!loggedIn || loggedIn !== 'true') {
      router.push('/login');
      return;
    }

    // Check if user is admin
    if (storedUserType.toLowerCase().trim() !== 'admin') {
      router.push('/dashboard');
      return;
    }

    loadLocations(true); // Initial load with loading indicator
    
    // Poll for online status every 2 seconds (completely silent, no loading indicators)
    const pollOnlineStatus = async () => {
      // Prevent multiple simultaneous polling requests
      if (isPolling.current) return;
      
      isPolling.current = true;
      try {
        const response = await fetch('/api/location/online-status', {
          credentials: 'include',
          cache: 'no-store', // Prevent caching
          // Add signal to make it abortable and silent
        });
        const data = await response.json();
        if (data.ok && data.statuses) {
          // Update online status for existing locations (remove duplicates)
          // Use functional update to prevent unnecessary re-renders
          setLocations((prevLocations) => {
            // First, remove duplicates by user_id
            const uniqueLocations = prevLocations.reduce((acc: Location[], loc: Location) => {
              if (!acc.find(l => l.user_id === loc.user_id)) {
                acc.push(loc);
              }
              return acc;
            }, []);
            
            // Then update statuses only if changed
            const updated = uniqueLocations.map((loc) => {
              const status = data.statuses.find((s: any) => s.user_id === loc.user_id);
              if (status) {
                // Only update if status actually changed
                if (loc.is_online !== status.is_online || loc.timestamp !== status.last_location_update) {
                  return {
                    ...loc,
                    is_online: status.is_online,
                    timestamp: status.last_location_update || loc.timestamp,
                  };
                }
              }
              return loc;
            });
            
            // Only update state if something actually changed
            const hasChanges = updated.some((loc, idx) => {
              const prev = uniqueLocations[idx];
              return !prev || loc.is_online !== prev.is_online || loc.timestamp !== prev.timestamp;
            });
            
            return hasChanges ? updated : prevLocations;
          });
          
          // Update selected location's online status if it matches (only if changed)
          const currentSelected = selectedLocationRef.current;
          if (currentSelected) {
            const status = data.statuses.find((s: any) => s.user_id === currentSelected.user_id);
            if (status && (currentSelected.is_online !== status.is_online || currentSelected.timestamp !== status.last_location_update)) {
              setSelectedLocation({
                ...currentSelected,
                is_online: status.is_online,
                timestamp: status.last_location_update || currentSelected.timestamp,
              });
            }
          }
        }
      } catch (error) {
        // Silently fail for polling - don't spam console
      } finally {
        isPolling.current = false;
      }
    };
    
    const onlineStatusInterval = setInterval(pollOnlineStatus, 2000);
    
    // Refresh full location data every 30 seconds (without loading overlay)
    const locationInterval = setInterval(() => loadLocations(false), 30000);
    
    return () => {
      clearInterval(onlineStatusInterval);
      clearInterval(locationInterval);
    };
  }, [router]);

  const loadLocations = async (showLoading = false) => {
    // Don't show loading if we're polling (unless explicitly requested via refresh button)
    if (isPolling.current && !showLoading) {
      return;
    }
    
    // Only set loading if:
    // 1. It's the initial load, OR
    // 2. Explicitly requested via refresh button
    const shouldShowLoading = isInitialLoad.current || showLoading;
    
    try {
      if (shouldShowLoading) {
        setLoading(true);
      }
      const response = await fetch('/api/location/latest', {
        credentials: 'include', // Include cookies for authentication
      });
      const data = await response.json();
      if (data.ok) {
        // Remove duplicates by user_id (keep first occurrence)
        const uniqueLocations = (data.locations || []).reduce((acc: Location[], loc: Location) => {
          if (!acc.find(l => l.user_id === loc.user_id)) {
            acc.push(loc);
          }
          return acc;
        }, []);
        
        setLocations(uniqueLocations);
        // Auto-select first online officer or first officer if none online
        if (uniqueLocations.length > 0 && !selectedLocation) {
          const onlineOfficer = uniqueLocations.find((loc: Location) => loc.is_online === 1);
          const firstOfficer = uniqueLocations[0];
          setSelectedLocation(onlineOfficer || firstOfficer);
        }
      } else {
        console.error('Error loading locations:', data.error);
      }
    } catch (error) {
      console.error('Error loading locations:', error);
    } finally {
      if (shouldShowLoading) {
        setLoading(false);
        // Mark initial load as complete after first load finishes
        if (isInitialLoad.current) {
          isInitialLoad.current = false;
        }
      }
    }
  };


  const loadHistory = async (userId: number) => {
    try {
      const response = await fetch(`/api/location/history?user_id=${userId}&hours=24`, {
        credentials: 'include', // Include cookies for authentication
      });
      const data = await response.json();
      if (data.ok) {
        setHistory(data.locations || []);
      }
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };

  // Format date as dd-mm-yyyy hh:mm am/pm
  const formatDateTime = (date: Date | string | null): string => {
    if (!date) return 'N/A';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${day}-${month}-${year} ${displayHours}:${minutes} ${ampm}`;
  };

  // Format offline duration as hh:mm:ss
  const formatOfflineDuration = (lastOnline: Date | string | null): string => {
    if (!lastOnline) return 'N/A';
    const lastOnlineDate = new Date(lastOnline);
    const now = new Date();
    const diffMs = now.getTime() - lastOnlineDate.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(diffSeconds / 3600);
    const minutes = Math.floor((diffSeconds % 3600) / 60);
    const seconds = diffSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  // Generate Google Maps embed URL for a location using coordinates
  const getMapEmbedUrl = (location: Location | null) => {
    if (!location || !location.latitude || !location.longitude) {
      // Default to DDRC location if no location selected or no coordinates
      return `https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3768.3880679064987!2d74.6945507768888!3d19.17824544875138!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bdcbb297b9e4bd9%3A0xaa0c06ad3162d83e!2sDistrict%20Disability%20Rehabilitation%20Center!5e0!3m2!1sen!2sin!4v1767783399311!5m2!1sen!2sin`;
    }
    // Use coordinates for embed URL - simple format that works without API key
    return `https://www.google.com/maps?q=${location.latitude},${location.longitude}&hl=en&z=14&output=embed`;
  };

  // Expose loadHistory to window for button click
  useEffect(() => {
    (window as any).loadHistory = loadHistory;
    return () => {
      delete (window as any).loadHistory;
    };
  }, []);

  // Only show loading spinner on initial load, never during polling
  if (loading && isInitialLoad.current) {
    return (
      <AdminLayout>
        <div className="container-fluid">
          <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
            <div className="spinner-border" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="container-fluid">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h1 className="title mb-0">Location Tracking</h1>
          <button className="btn btn-primary" onClick={() => loadLocations(true)}>
            <i className="bi bi-arrow-clockwise me-2"></i>
            Refresh
          </button>
        </div>

        <div className="row">
          <div className="col-12 col-lg-4">
            <div className="card">
              <div className="card-header">
                <h5 className="card-title mb-0">
                  Field Officers ({(() => {
                    if (!searchQuery.trim()) return locations.length;
                    const filtered = locations.filter((loc) => {
                      const query = searchQuery.toLowerCase().trim();
                      const name = (loc.name || '').toLowerCase();
                      const phone = (loc.contact_number || '').toLowerCase();
                      return name.includes(query) || phone.includes(query);
                    });
                    return filtered.length;
                  })()})
                </h5>
              </div>
              <div className="card-body">
                {/* Search Bar */}
                <div className="mb-3">
                  <div className="input-group">
                    <span className="input-group-text">
                      <i className="bi bi-search"></i>
                    </span>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Search by name or phone..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                      <button
                        className="btn btn-outline-secondary"
                        type="button"
                        onClick={() => setSearchQuery('')}
                        title="Clear search"
                      >
                        <i className="bi bi-x"></i>
                      </button>
                    )}
                  </div>
                </div>

                {/* Info Note */}
                <div className="alert alert-info mb-3 py-2" style={{ fontSize: '0.85rem' }}>
                  <i className="bi bi-info-circle me-2"></i>
                  <strong>Note:</strong> "Offline" means either the field officer's app is not running right now or they are not logged in.
                </div>
                
                <div style={{ maxHeight: '550px', overflowY: 'auto' }}>
                  {locations.length === 0 ? (
                    <p className="text-muted">No location data available</p>
                  ) : (() => {
                    // Filter locations based on search query
                    const filteredLocations = locations.filter((location) => {
                      if (!searchQuery.trim()) return true;
                      const query = searchQuery.toLowerCase().trim();
                      const name = (location.name || '').toLowerCase();
                      const phone = (location.contact_number || '').toLowerCase();
                      return name.includes(query) || phone.includes(query);
                    });
                    
                    if (filteredLocations.length === 0) {
                      return (
                        <p className="text-muted text-center py-3">
                          <i className="bi bi-search me-2"></i>
                          No field officers found matching "{searchQuery}"
                        </p>
                      );
                    }
                    
                    return (
                      <div className="list-group">
                        {filteredLocations.map((location) => (
                      <div
                        key={location.user_id}
                        className={`list-group-item list-group-item-action ${
                          selectedLocation?.user_id === location.user_id ? 'active' : ''
                        }`}
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
                          if (location.user_id) {
                            loadHistory(location.user_id);
                          }
                          setSelectedLocation(location);
                        }}
                      >
                        <div className="d-flex w-100 justify-content-between align-items-start">
                          <div className="flex-grow-1">
                            <div className="d-flex align-items-center gap-2 mb-1">
                              <h6 className="mb-0">{location.name}</h6>
                              {location.is_online === 1 ? (
                                <span className="badge bg-success" style={{ fontSize: '0.65rem' }}>
                                  <i className="bi bi-circle-fill me-1" style={{ fontSize: '0.5rem' }}></i>
                                  Online
                                </span>
                              ) : (
                                <span className="badge bg-secondary" style={{ fontSize: '0.65rem' }}>
                                  <i className="bi bi-circle-fill me-1" style={{ fontSize: '0.5rem' }}></i>
                                  Offline
                                </span>
                              )}
                            </div>
                            <p className="mb-1 small text-muted">{location.contact_number}</p>
                            {location.latitude && location.longitude ? (
                              <small className="text-muted">
                                {Number(location.latitude).toFixed(6)}, {Number(location.longitude).toFixed(6)}
                                {location.timestamp && (
                                  <span className="ms-2">
                                    {formatDateTime(location.timestamp)}
                                  </span>
                                )}
                              </small>
                            ) : (
                              <small className="text-muted">No location data available</small>
                            )}
                            {location.is_online === 0 && location.last_online && (
                              <small className="text-muted d-block mt-1" style={{ fontSize: '0.7rem', color: '#dc3545' }}>
                                Offline for: {formatOfflineDuration(location.last_online)}
                              </small>
                            )}
                          </div>
                        </div>
                      </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            {selectedLocation && selectedLocation.user_id && history.length > 0 && (
              <div className="card mt-3">
                <div className="card-header">
                  <h6 className="card-title mb-0">Location History (Last 24 Hours)</h6>
                </div>
                <div className="card-body" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  <div className="list-group list-group-flush">
                    {history.slice(0, 20).map((loc, idx) => (
                      <div key={idx} className="list-group-item">
                        <small>
                          <strong>{loc.timestamp ? formatDateTime(loc.timestamp) : 'N/A'}</strong>
                          <br />
                          {loc.latitude && loc.longitude ? (
                            `${Number(loc.latitude).toFixed(6)}, ${Number(loc.longitude).toFixed(6)}`
                          ) : (
                            'No coordinates'
                          )}
                        </small>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="col-12 col-lg-8">
            <div className="card">
              <div className="card-header">
                <h5 className="card-title mb-0">Map View</h5>
              </div>
              <div className="card-body p-0">
                {!selectedLocation || !selectedLocation.latitude || !selectedLocation.longitude ? (
                  <div style={{ height: '600px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5' }}>
                    <div className="text-center p-4">
                      <i className="bi bi-map text-muted" style={{ fontSize: '3rem' }}></i>
                      <h5 className="mt-3">
                        {selectedLocation ? `${selectedLocation.name} - No Location Data` : 'No Location Selected'}
                      </h5>
                      <p className="text-muted">
                        {selectedLocation 
                          ? 'This field officer has not shared their location yet.'
                          : 'Select a field officer from the list to view their location on the map.'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div style={{ position: 'relative', width: '100%', height: '600px' }}>
                    <iframe
                      src={getMapEmbedUrl(selectedLocation)}
                      width="100%"
                      height="100%"
                      style={{ border: 0 }}
                      allowFullScreen={true}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      title="Field Officer Location Map"
                    ></iframe>
                    {selectedLocation && (
                      <div className="position-absolute top-0 end-0 m-3" style={{ maxWidth: '300px', zIndex: 10 }}>
                        <div className="card shadow-sm">
                          <div className="card-body p-2">
                            <div className="d-flex align-items-center gap-2 mb-1">
                              <h6 className="card-title mb-0" style={{ fontSize: '0.9rem' }}>{selectedLocation.name}</h6>
                              {selectedLocation.is_online === 1 ? (
                                <span className="badge bg-success" style={{ fontSize: '0.6rem' }}>Online</span>
                              ) : (
                                <span className="badge bg-secondary" style={{ fontSize: '0.6rem' }}>Offline</span>
                              )}
                            </div>
                            <p className="card-text mb-1" style={{ fontSize: '0.75rem' }}>
                              <strong>Phone:</strong> {selectedLocation.contact_number}
                            </p>
                            {selectedLocation.is_online === 1 ? (
                              <>
                                {selectedLocation.timestamp && (
                                  <p className="card-text mb-1" style={{ fontSize: '0.75rem' }}>
                                    <strong>Last Update:</strong> {formatDateTime(selectedLocation.timestamp)}
                                  </p>
                                )}
                                {selectedLocation.last_online && (
                                  <p className="card-text mb-1" style={{ fontSize: '0.75rem' }}>
                                    <strong>Last Online:</strong> {formatDateTime(selectedLocation.last_online)}
                                  </p>
                                )}
                              </>
                            ) : (
                              <>
                                {selectedLocation.last_online && (
                                  <>
                                    <p className="card-text mb-1" style={{ fontSize: '0.75rem' }}>
                                      <strong>Last Online:</strong> {formatDateTime(selectedLocation.last_online)}
                                    </p>
                                    <p className="card-text mb-1" style={{ fontSize: '0.75rem', color: '#dc3545' }}>
                                      <strong>Offline for:</strong> {formatOfflineDuration(selectedLocation.last_online)}
                                    </p>
                                  </>
                                )}
                              </>
                            )}
                            {selectedLocation.accuracy && (
                              <p className="card-text mb-0" style={{ fontSize: '0.75rem' }}>
                                <strong>Accuracy:</strong> {Number(selectedLocation.accuracy).toFixed(2)}m
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
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

