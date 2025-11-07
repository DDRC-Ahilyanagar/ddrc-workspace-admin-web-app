'use client';

import { useState, useEffect } from 'react';
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

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

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
    { path: '/admin/rate', label: 'दर (Field officer)', icon: 'bi-cash-coin' },
    { path: '/api-docs', label: 'API दस्तऐवज', icon: 'bi-book' },
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

