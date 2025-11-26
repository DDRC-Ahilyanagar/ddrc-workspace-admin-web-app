'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userName, setUserName] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [mounted, setMounted] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
    const loggedIn = localStorage.getItem('logged_in');
    if (!loggedIn) {
      router.push('/login');
    } else {
      setUserName(localStorage.getItem('user_name') || '');
      setUserPhone(localStorage.getItem('user_phone') || '');
    }
  }, [router]);

  // Fetch pending access requests count - runs silently in background
  useEffect(() => {
    if (!mounted) return;

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
  }, [mounted]);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const toggleNotifications = () => {
    setShowNotifications((prev) => !prev);
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

  const menuItems = [
    { path: '/dashboard', label: 'डॅशबोर्ड', icon: 'bi-speedometer2' },
    { path: '/survekshan', label: 'सर्वेक्षण', icon: 'bi-clipboard-check' },
    { path: '/sections', label: 'सेक्शन', icon: 'bi-folder' },
    { path: '/questions', label: 'सर्वेक्षण प्रश्नावली', icon: 'bi-question-circle' },
    { path: '/access-requests', label: 'प्रवेश विनंत्या', icon: 'bi-person-plus' },
    { path: '/officers', label: 'Field Officers', icon: 'bi-people' },
    { path: '/admin/rate', label: 'दर (Field officer)', icon: 'bi-cash-coin' },
  ];

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
            {/* Notification Bell */}
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
                    {pendingRequests.slice(0, 5).map((req, index) => (
                      <div key={`notif-${index}`} className="list-group-item">
                        <div className="fw-semibold">{req?.name || 'नाव उपलब्ध नाही'}</div>
                        <div className="small text-muted">{req?.phone || ''}</div>
                        <div className="text-muted small">{req?.created_at ? new Date(req.created_at).toLocaleString('mr-IN') : ''}</div>
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
        {/* Sidebar */}
        <aside className={`admin-sidebar ${sidebarOpen ? 'open animate__animated animate__fadeInLeft' : 'closed animate__animated animate__fadeOutLeft'}`}>
          <nav className="sidebar-nav">
            <div className="sidebar-logo-container mb-3 d-flex justify-content-center align-items-center animate__animated animate__fadeInDown" style={{ padding: '1rem' }}>
              <img 
                src="/colored_logo.png" 
                alt="DDRC Logo" 
                style={{ maxWidth: '100%', height: 'auto', maxHeight: '80px' }}
              />
            </div>
            <ul className="nav flex-column">
              {menuItems.map((item, index) => (
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
                      router.push(item.path);
                    }}
                  >
                    <i className={`nav-icon ${item.icon}`}></i>
                    <span className="nav-label">{item.label}</span>
                  </a>
                </li>
              ))}
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

