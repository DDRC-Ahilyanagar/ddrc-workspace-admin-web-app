'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

// Use relative path for static assets to avoid hydration mismatch
const LOGO_URL = '/ddrc app icon (192 x 192 px) (1024 x 1024 px)(1).png';

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
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [activeTab, setActiveTab] = useState<'requests' | 'alerts'>('requests');
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

  // Fetch pending access requests count and admin notifications
  useEffect(() => {
    if (!mounted) return;

    // Check if user is logged in first
    const loggedIn = localStorage.getItem('logged_in');
    if (!loggedIn || loggedIn !== 'true') {
      return; // Don't fetch if not logged in
    }

    const storedUserType = localStorage.getItem('user_type') || '';
    const currentUserType = (userType || storedUserType)?.toLowerCase().trim();

    // Only fetch for admin or verification officer
    const isAllowed = ['admin', 'administrator', 'verification_officer'].some(t => currentUserType.includes(t));
    if (!isAllowed) return;

    let isMounted = true;
    let intervalId: NodeJS.Timeout | null = null;

    const fetchAllNotifications = async () => {
      try {
        // 1. Fetch Access Requests (Admin Only)
        if (currentUserType === 'admin' || currentUserType === 'administrator') {
          const res = await fetch('/api/access-requests?status=pending', {
            cache: 'no-store',
            credentials: 'include',
          });
          const json = await res.json();
          if (json.ok && Array.isArray(json.data) && isMounted) {
            setPendingCount(json.data.length);
            setPendingRequests(json.data);
          }
        }

        // 2. Fetch General Admin Notifications (Admin & Verification Officer)
        const notifRes = await fetch('/api/admin/notifications?limit=20', {
          cache: 'no-store',
          credentials: 'include',
        });
        const notifJson = await notifRes.json();
        if (notifJson.ok && isMounted) {
          setNotifications(notifJson.notifications || []);
          setUnreadNotificationsCount(notifJson.unread_count || 0);
        }
      } catch (err: any) {
        if (isMounted) console.error('Failed to fetch notifications:', err);
      }
    };

    // Initial fetch
    fetchAllNotifications();

    // Refresh every 30 seconds
    intervalId = setInterval(() => {
      if (isMounted) fetchAllNotifications();
    }, 30000);

    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [mounted, userType]);

  const markAsRead = async (notificationId?: number, markAll: boolean = false) => {
    try {
      const res = await fetch('/api/admin/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notification_id: notificationId,
          mark_all_read: markAll
        }),
      });
      const json = await res.json();
      if (json.ok) {
        if (markAll) {
          setUnreadNotificationsCount(0);
          setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        } else if (notificationId) {
          setUnreadNotificationsCount(prev => Math.max(0, prev - 1));
          setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n));
        }
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

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
    // Only show system logs for specific authorized developer
    ...(userPhone === '7768068585' ? [{ path: '/admin/logs', label: 'System Logs', icon: 'bi-terminal' }] : []),
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
            <Link href="/" className="text-decoration-none animate__animated animate__fadeInLeft">
              <span className="text-white fw-bold tracking-tight">DDRC <span className="text-blue-400">ADMIN</span></span>
            </Link>
          </div>

          <div className="d-flex align-items-center animate__animated animate__fadeInRight">
            {/* Notification Bell */}
            <div className="notification-wrapper position-relative me-3" ref={notifRef}>
              <button
                className="btn btn-link text-white position-relative"
                onClick={toggleNotifications}
                style={{ textDecoration: 'none', padding: '0.5rem' }}
                title="सूचना"
                aria-expanded={showNotifications}
              >
                <i className={`bi ${showNotifications ? 'bi-bell-fill' : 'bi-bell'}`} style={{ fontSize: '1.5rem' }}></i>
                {(pendingCount + unreadNotificationsCount) > 0 && (
                  <span
                    className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger"
                    style={{
                      fontSize: '0.7rem',
                      padding: '0.25rem 0.5rem',
                      minWidth: '1.5rem',
                      zIndex: 2
                    }}
                  >
                    {(pendingCount + unreadNotificationsCount) > 99 ? '99+' : (pendingCount + unreadNotificationsCount)}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div
                  className="card shadow notification-dropdown animate__animated animate__fadeIn"
                  style={{
                    minWidth: '350px',
                    position: 'absolute',
                    right: 0,
                    top: '120%',
                    zIndex: 1050,
                    borderRadius: '12px',
                    overflow: 'hidden',
                    border: 'none'
                  }}
                >
                  <div className="card-header bg-white border-bottom py-3 px-3">
                    <div className="d-flex justify-content-between align-items-center mb-0">
                      <h6 className="mb-0 fw-bold">सूचना केंद्र</h6>
                      <span className="badge bg-primary rounded-pill">
                        {pendingCount + unreadNotificationsCount} नवीन
                      </span>
                    </div>
                  </div>

                  {/* Tabs */}
                  {!isVerificationOfficer && (
                    <div className="d-flex bg-light border-bottom">
                      <button
                        className={`btn btn-sm flex-fill py-2 rounded-0 border-0 ${activeTab === 'requests' ? 'bg-white fw-bold border-bottom border-primary border-2 text-primary' : 'text-muted'}`}
                        onClick={() => setActiveTab('requests')}
                      >
                        <i className="bi bi-person-plus me-1"></i>
                        प्रवेश विनंत्या ({pendingCount})
                      </button>
                      <button
                        className={`btn btn-sm flex-fill py-2 rounded-0 border-0 ${activeTab === 'alerts' ? 'bg-white fw-bold border-bottom border-primary border-2 text-primary' : 'text-muted'}`}
                        onClick={() => setActiveTab('alerts')}
                      >
                        <i className="bi bi-info-circle me-1"></i>
                        सूचना ({unreadNotificationsCount})
                      </button>
                    </div>
                  )}

                  <div className="list-group list-group-flush" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                    {/* Access Requests Tab Content (Admin Only) */}
                    {(activeTab === 'requests' && !isVerificationOfficer) && (
                      <>
                        {pendingRequests.length === 0 ? (
                          <div className="text-center py-5 text-muted">
                            <i className="bi bi-check2-circle d-block mb-2" style={{ fontSize: '2rem', opacity: 0.5 }}></i>
                            नवीन विनंत्या नाहीत
                          </div>
                        ) : (
                          pendingRequests.slice(0, 5).map((req) => (
                            <div
                              key={`notif-req-${req?.id || Math.random()}`}
                              className="list-group-item list-group-item-action py-3 border-start border-4 border-warning"
                              onClick={() => {
                                router.push('/access-requests');
                                setShowNotifications(false);
                              }}
                            >
                              <div className="d-flex justify-content-between align-items-start">
                                <div>
                                  <div className="fw-bold text-dark">{req?.name || 'नवीन विनंती'}</div>
                                  <div className="small text-muted mb-1"><i className="bi bi-telephone text-primary me-1"></i> {req?.phone || ''}</div>
                                  <div className="small text-muted" style={{ fontSize: '0.75rem' }}>
                                    <i className="bi bi-clock me-1"></i>
                                    {req?.created_at ? new Date(req.created_at).toLocaleString('mr-IN', {
                                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                    }) : ''}
                                  </div>
                                </div>
                                <span className="badge bg-warning text-dark px-2 py-1">प्रलंबित</span>
                              </div>
                            </div>
                          ))
                        )}
                        {pendingRequests.length > 0 && (
                          <div className="card-footer bg-light text-center py-2">
                            <button className="btn btn-sm btn-link text-primary text-decoration-none fw-bold" onClick={() => { router.push('/access-requests'); setShowNotifications(false); }}>सर्व विनंत्या पहा</button>
                          </div>
                        )}
                      </>
                    )}

                    {/* General Notifications Tab Content (Admin & VO) */}
                    {(activeTab === 'alerts' || isVerificationOfficer) && (
                      <>
                        {(notifications || []).length === 0 ? (
                          <div className="text-center py-5 text-muted">
                            <i className="bi bi-bell-slash d-block mb-2" style={{ fontSize: '2rem', opacity: 0.5 }}></i>
                            सूचना नाहीत
                          </div>
                        ) : (
                          <>
                            {notifications.map((notif: any) => (
                              <div
                                key={`notif-alert-${notif.id}`}
                                className={`list-group-item list-group-item-action py-3 ${!notif.is_read ? 'bg-light border-start border-4 border-primary' : ''}`}
                                style={{ cursor: 'pointer' }}
                                onClick={async () => {
                                  if (!notif.is_read) {
                                    await markAsRead(notif.id);
                                  }

                                  // Mark as read and navigate if needed
                                  if (notif.data?.survey_id) {
                                    router.push(`/survekshan?id=${notif.data.survey_id}`);
                                  } else if (notif.data?.aadhaar_id) {
                                    // If we have aadhaar_id but not survey_id link, try to go to reports or surveys
                                    router.push(`/survekshan?search=${notif.data.aadhaar_id}`);
                                  } else {
                                    router.push('/survekshan');
                                  }
                                  setShowNotifications(false);
                                }}
                              >
                                <div className="d-flex gap-3">
                                  <div className={`rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 ${notif.type.includes('accepted') ? 'bg-success-subtle text-success' : notif.type.includes('rejected') ? 'bg-danger-subtle text-danger' : 'bg-primary-subtle text-primary'}`} style={{ width: '40px', height: '40px' }}>
                                    <i className={`bi ${notif.type.includes('accepted') ? 'bi-check-circle' : notif.type.includes('rejected') ? 'bi-x-circle' : 'bi-info-circle'}`}></i>
                                  </div>
                                  <div className="flex-grow-1">
                                    <div className="d-flex justify-content-between">
                                      <div className={`fw-bold ${!notif.is_read ? 'text-dark' : 'text-muted'}`}>{notif.title}</div>
                                      {!notif.is_read && <span className="p-1 bg-primary border border-light rounded-circle" style={{ height: '8px', width: '8px' }}></span>}
                                    </div>
                                    <div className="small text-muted mb-1">{notif.message}</div>
                                    <div className="small text-muted" style={{ fontSize: '0.75rem' }}>
                                      {new Date(notif.created_at).toLocaleString('mr-IN', {
                                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                      })}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                            {unreadNotificationsCount > 0 && (
                              <div className="card-footer bg-light text-center py-2">
                                <button
                                  className="btn btn-sm btn-link text-primary text-decoration-none fw-bold"
                                  onClick={() => markAsRead(undefined, true)}
                                >
                                  सर्व वाचल्या म्हणून चिन्हांकित करा
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

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
            <div className="sidebar-logo-container mb-4 d-flex justify-content-center align-items-center animate__animated animate__fadeInDown" style={{ padding: '1.5rem' }}>
              <Link href="/" className="d-flex justify-content-center">
                <div className="p-3 bg-white/10 rounded-3xl backdrop-blur-sm border border-white/10 shadow-xl transform rotate-3 hover:rotate-0 transition-transform duration-500">
                  <img
                    src={LOGO_URL}
                    alt="DDRC Logo"
                    style={{ maxWidth: '100%', height: 'auto', maxHeight: '70px', filter: 'brightness(1.1)' }}
                  />
                </div>
              </Link>
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
            <div className="mt-auto px-4 pb-4">
              <Link href="/" className="nav-link text-white/70 hover:text-white transition-colors no-underline d-flex align-items-center gap-2 py-3 border-top border-white/10">
                <i className="bi bi-house-door"></i>
                <span className="nav-label">Back to Home</span>
              </Link>
            </div>
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

