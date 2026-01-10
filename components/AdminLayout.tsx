'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { getAbsoluteImageUrl } from '@/lib/config';

const LOGO_URL = getAbsoluteImageUrl('/ddrc app icon (192 x 192 px) (1024 x 1024 px)(1).png');

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  // Close sidebar by default on mobile, open on desktop
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth > 768;
    }
    return true;
  });
  const [userName, setUserName] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [userType, setUserType] = useState('');
  const [mounted, setMounted] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  // Language state - load from localStorage or default to 'mr' (Marathi)
  const [language, setLanguage] = useState<'en' | 'mr'>(() => {
    if (typeof window !== 'undefined') {
      const storedLang = localStorage.getItem('app_language');
      return (storedLang === 'en' || storedLang === 'mr') ? storedLang : 'mr';
    }
    return 'mr';
  });
  const notifRef = useRef<HTMLDivElement | null>(null);
  const sidebarRef = useRef<HTMLElement | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
    const loggedIn = localStorage.getItem('logged_in');
    if (!loggedIn || loggedIn !== 'true') {
      router.push('/login');
      return; // Exit early - don't proceed with any API calls
    }

    // Only proceed if user is logged in
    setUserName(localStorage.getItem('user_name') || '');
    const phone = localStorage.getItem('user_phone') || '';
    setUserPhone(phone);

    // Get user_type from localStorage first (for immediate render)
    const storedUserType = localStorage.getItem('user_type') || '';
    setUserType(storedUserType);

    // Always fetch user_type from API to ensure it's current
    if (phone) {
      const fetchUserType = async () => {
        try {
          const response = await fetch('/api/app/dashboard', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ phone }),
          });
          const data = await response.json();
          if (data.ok && data.user) {
            // Get user_type from the response
            const fetchedUserType = (data.user.user_type || '').toString().trim().toLowerCase();
            if (fetchedUserType) {
              console.log('Fetched user_type from API:', fetchedUserType);
              setUserType(fetchedUserType);
              localStorage.setItem('user_type', fetchedUserType);
            }
          }
        } catch (err) {
          console.error('Failed to fetch user type:', err);
        }
      };
      fetchUserType();
    }

    // Handle window resize to adjust sidebar on mobile/desktop switch
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (mobile) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };

    // Set initial mobile state
    setIsMobile(window.innerWidth <= 768);

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [router]);

  // Fetch pending access requests count - runs silently in background
  // Only fetch for admin users, skip for verification officers
  // IMPORTANT: Only fetch when user is logged in
  useEffect(() => {
    if (!mounted) return;

    // Check if user is logged in first
    const loggedIn = localStorage.getItem('logged_in');
    if (!loggedIn || loggedIn !== 'true') {
      return; // Don't fetch if not logged in
    }

    // Skip fetching access requests for verification officers
    // Check both state and localStorage for user type
    const storedUserType = localStorage.getItem('user_type') || '';
    const currentUserType = (userType || storedUserType)?.toLowerCase().trim();
    if (currentUserType === 'verification_officer') {
      return; // Don't fetch access requests for verification officers
    }

    // Only fetch for admin users
    if (currentUserType !== 'admin' && currentUserType !== 'administrator') {
      return; // Don't fetch if not admin
    }

    let isMounted = true;
    let intervalId: NodeJS.Timeout | null = null;
    let abortController: AbortController | null = null;

    const fetchPendingCount = async () => {
      // Cancel any previous request
      if (abortController) {
        abortController.abort();
      }

      abortController = new AbortController();

      try {
        const res = await fetch('/api/access-requests?status=pending', {
          cache: 'no-store',
          credentials: 'include',
          signal: abortController.signal,
          // Prevent any navigation or page refresh
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!isMounted || abortController.signal.aborted) return;

        const json = await res.json();
        if (json.ok && Array.isArray(json.data) && isMounted) {
          setPendingCount(json.data.length);
          setPendingRequests(json.data);
        }
      } catch (err: any) {
        // Ignore abort errors and only log real errors
        if (err.name !== 'AbortError' && isMounted) {
          console.error('Failed to fetch pending count:', err);
        }
      }
    };

    // Initial fetch
    fetchPendingCount();

    // Refresh count every 30 seconds
    intervalId = setInterval(() => {
      if (isMounted) {
        fetchPendingCount();
      }
    }, 30000);

    // Cleanup
    return () => {
      isMounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
      if (abortController) {
        abortController.abort();
      }
    };
  }, [mounted, userType]);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isMobile && sidebarOpen) {
        if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
          const target = event.target as HTMLElement;
          // Don't close if clicking the toggle button or backdrop
          if (!target.closest('.sidebar-toggle') && !target.closest('.sidebar-backdrop')) {
            setSidebarOpen(false);
          }
        }
      }
    };

    if (sidebarOpen && isMobile) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [sidebarOpen, isMobile]);

  const toggleNotifications = () => {
    setShowNotifications((prev) => !prev);
  };

  // Toggle language and save to localStorage
  const toggleLanguage = () => {
    const newLanguage = language === 'en' ? 'mr' : 'en';
    setLanguage(newLanguage);
    localStorage.setItem('app_language', newLanguage);
    // Optionally reload the page to apply language changes
    // window.location.reload();
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };

    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications]);

  const handleLogout = () => {
    localStorage.removeItem('logged_in');
    localStorage.removeItem('user_name');
    localStorage.removeItem('user_phone');
    localStorage.removeItem('token');
    router.push('/login');
  };

  // Different menu items based on user type
  // Don't render anything if not logged in
  if (typeof window !== 'undefined') {
    const loggedIn = localStorage.getItem('logged_in');
    if (!loggedIn || loggedIn !== 'true') {
      return null; // Don't render if not logged in - prevents all API calls
    }
  }

  const isVerificationOfficer = userType?.toLowerCase().trim() === 'verification_officer';
  const isAuthorizedAdmin = userPhone === '7768068585' && userType?.toLowerCase().trim() === 'admin';

  const adminMenuItems = [
    { path: '/dashboard', label: 'डॅशबोर्ड', icon: 'bi-speedometer2' },
    { path: '/survekshan', label: 'सर्वेक्षण', icon: 'bi-clipboard-check' },
    { path: '/sections', label: 'सेक्शन', icon: 'bi-folder' },
    { path: '/questions', label: 'सर्वेक्षण प्रश्नावली', icon: 'bi-question-circle' },
    { path: '/access-requests', label: 'प्रवेश विनंत्या', icon: 'bi-person-plus' },
    { path: '/officers', label: 'Field Officers', icon: 'bi-people' },
    { path: '/admin/rate', label: 'दर (Field officer)', icon: 'bi-cash-coin' },
    { path: '/admin/location-tracking', label: 'Location Tracking', icon: 'bi-geo-alt' },
    // Only show media backup for authorized admin
    ...(isAuthorizedAdmin ? [{ path: '/admin/media-backup', label: 'Media Backup', icon: 'bi-images' }] : []),
  ];

  const verificationOfficerMenuItems = [
    { path: '/survekshan', label: 'सर्वेक्षण', icon: 'bi-clipboard-check' },
    { path: '/verification-officer/village-lookup', label: 'गाव नावे शोधा', icon: 'bi-search' },
    { path: '/verification-officer/excel-import', label: 'Excel Import/Export', icon: 'bi-file-earmark-excel' },
  ];

  // Default to admin menu items if userType is not set or empty
  // Only use verification officer menu if userType is explicitly set and matches
  const menuItems: Array<{ path: string; label: string; icon: string }> =
    (userType && userType.trim() && isVerificationOfficer)
      ? verificationOfficerMenuItems
      : adminMenuItems;

  // Debug: Log menu items in useEffect to avoid render-time issues
  useEffect(() => {
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      console.log('AdminLayout - userType:', userType, 'isVerificationOfficer:', isVerificationOfficer);
      console.log('AdminLayout - menuItems count:', menuItems?.length || 0);
    }
  }, [userType, isVerificationOfficer]);

  if (!mounted) {
    return null;
  }

  return (
    <div className="admin-layout animate__animated animate__fadeIn">
      {/* Top Navigation */}
      <nav className="admin-top-nav animate__animated animate__fadeInDown">
        <div className="d-flex align-items-center justify-content-between w-100">
          <div className="d-flex align-items-center">
            <button
              className="btn btn-link text-white me-3 sidebar-toggle animate__animated animate__pulse"
              onClick={toggleSidebar}
              aria-label="Toggle sidebar"
              onMouseEnter={(e) => e.currentTarget.classList.add('animate__pulse')}
            >
              <i className="bi bi-list" style={{ fontSize: '1.5rem' }}></i>
            </button>
            <div className="d-flex align-items-center animate__animated animate__fadeInLeft">
              <span className="text-white fw-bold">DDRC Survey Portal</span>
            </div>
          </div>

          <div className="d-flex align-items-center animate__animated animate__fadeInRight">
            {/* Notification Bell - Only show for admin */}
            {!isVerificationOfficer && (
              <div className="notification-wrapper position-relative me-3" ref={notifRef}>
                <button
                  className="btn btn-link text-white position-relative"
                  onClick={toggleNotifications}
                  style={{ textDecoration: 'none', padding: '0.5rem' }}
                  title="प्रवेश विनंत्या"
                  aria-expanded={showNotifications}
                >
                  <i className={`bi ${showNotifications ? 'bi-bell-fill' : 'bi-bell'}`} style={{ fontSize: '1.5rem' }}></i>
                  {pendingCount > 0 && (
                    <span
                      className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger"
                      style={{
                        fontSize: '0.7rem',
                        padding: '0.25rem 0.5rem',
                        minWidth: '1.5rem',
                      }}
                    >
                      {pendingCount > 99 ? '99+' : pendingCount}
                    </span>
                  )}
                </button>

                {showNotifications && (
                  <div
                    className="card shadow notification-dropdown animate__animated animate__fadeIn"
                    style={{
                      minWidth: '320px',
                      position: 'absolute',
                      right: 0,
                      top: '120%',
                      zIndex: 1050,
                    }}
                  >
                    <div className="card-header d-flex justify-content-between align-items-center py-2">
                      <strong>प्रवेश विनंत्या</strong>
                      <span className="badge bg-primary">{pendingCount}</span>
                    </div>
                    <div className="list-group list-group-flush" style={{ maxHeight: '260px', overflowY: 'auto' }}>
                      {pendingRequests.length === 0 && (
                        <div className="text-center py-3 text-muted">नवीन विनंत्या नाहीत</div>
                      )}
                      {pendingRequests.slice(0, 5).map((req) => (
                        <div
                          key={`notif-${req?.id || Math.random()}`}
                          className="list-group-item"
                          style={{
                            cursor: 'pointer',
                            transition: 'background-color 0.2s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#f8f9fa';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '';
                          }}
                          onClick={() => {
                            router.push('/access-requests');
                            setShowNotifications(false);
                          }}
                        >
                          <div className="fw-semibold">{req?.name || 'नाव उपलब्ध नाही'}</div>
                          <div className="small text-muted">{req?.phone || ''}</div>
                          <div className="text-muted small">
                            {req?.created_at ? new Date(req.created_at).toLocaleString('mr-IN', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            }) : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="card-footer text-center py-2">
                      <button
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => {
                          router.push('/access-requests');
                          setShowNotifications(false);
                        }}
                      >
                        सर्व पहा
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Language Switch Button */}
            <button
              className="btn btn-link text-white me-3"
              onClick={toggleLanguage}
              title={language === 'en' ? 'Switch to Marathi' : 'Switch to English'}
              style={{ textDecoration: 'none', padding: '0.5rem' }}
            >
              <i className="bi bi-translate" style={{ fontSize: '1.25rem' }}></i>
              <span className="ms-1" style={{ fontSize: '0.875rem' }}>
                {language === 'en' ? 'MR' : 'EN'}
              </span>
            </button>

            <div className="user-info me-3">
              <span className="text-white">{userName || 'User'}</span>
              <small className="text-white-50 d-block">{userPhone || ''}</small>
            </div>
            <button
              className="btn btn-outline-light btn-sm"
              onClick={handleLogout}
            >
              लॉगआउट
            </button>
          </div>
        </div>
      </nav>

      <div className="admin-content-wrapper">
        {/* Sidebar Backdrop for Mobile */}
        {sidebarOpen && isMobile && (
          <div
            className="sidebar-backdrop"
            onClick={() => setSidebarOpen(false)}
            style={{
              position: 'fixed',
              top: '70px',
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              zIndex: 1040,
              transition: 'opacity 0.3s ease'
            }}
          />
        )}

        {/* Sidebar */}
        <aside
          ref={sidebarRef}
          className={`admin-sidebar ${sidebarOpen ? 'open animate__animated animate__fadeInLeft' : 'closed animate__animated animate__fadeOutLeft'}`}
        >
          <nav className="sidebar-nav">
            <div className="sidebar-logo-container mb-3 d-flex justify-content-center align-items-center animate__animated animate__fadeInDown" style={{ padding: '1rem' }}>
              <img
                src={LOGO_URL}
                alt="DDRC Logo"
                style={{ maxWidth: '100%', height: 'auto', maxHeight: '80px' }}
              />
            </div>
            <ul className="nav flex-column">
              {menuItems && menuItems.length > 0 ? (
                menuItems.map((item, index) => (
                  <li
                    key={item.path}
                    className="nav-item animate__animated animate__fadeInUp"
                    style={{ animationDelay: `${index * 0.1}s`, animationDuration: '0.5s' }}
                  >
                    <a
                      className={`nav-link ${pathname === item.path ? 'active' : ''}`}
                      href={item.path}
                      onClick={(e) => {
                        e.preventDefault();
                        // Close sidebar on mobile when navigating
                        if (isMobile) {
                          setSidebarOpen(false);
                        }
                        router.push(item.path);
                      }}
                    >
                      <i className={`nav-icon ${item.icon}`}></i>
                      <span className="nav-label">{item.label}</span>
                    </a>
                  </li>
                ))
              ) : (
                <li className="nav-item">
                  <span className="nav-link text-muted">No menu items available</span>
                </li>
              )}
            </ul>
          </nav>
        </aside>

        {/* Main Content */}
        <main className={`admin-main-content ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'} animate__animated animate__fadeIn`}>
          <div className="admin-content-inner animate__animated animate__fadeInUp" style={{ animationDelay: '0.2s' }}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

