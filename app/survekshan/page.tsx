'use client';

/**
 * Survekshan Page Component
 * 
 * Displays a list of surveys (सर्वेक्षण यादी) using DataTables with server-side processing.
 * Features:
 * - Server-side pagination, sorting, and searching
 * - Real-time data loading from /api/admin/surveys
 * - Marathi language support for UI elements
 * - View survey details functionality
 */

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import AdminLayout from '@/components/AdminLayout';

export const dynamic = 'force-dynamic';

export default function SurvekshanPage() {
  const router = useRouter();
  
  // Refs for table element and DataTable instance
  const tableRef = useRef<HTMLTableElement>(null);
  const dtInstanceRef = useRef<any>(null);
  
  // State to track DataTables script loading
  const [dataTablesLoaded, setDataTablesLoaded] = useState(false);
  
  // Prevent multiple initialization attempts
  const initAttemptedRef = useRef(false);
  
  // User type and filter state
  const [userType, setUserType] = useState('');
  const [filterType, setFilterType] = useState('all');

  // Get user type on mount
  useEffect(() => {
    const storedUserType = localStorage.getItem('user_type') || '';
    setUserType(storedUserType);
  }, []);

  // Reload DataTable when filter changes
  useEffect(() => {
    if (dtInstanceRef.current && filterType) {
      dtInstanceRef.current.ajax.reload();
    }
  }, [filterType]);

  /**
   * Setup global handler for DataTable view action button
   * This allows the dynamically rendered buttons in DataTable to navigate to survey details
   */
  useEffect(() => {
    (window as any).handleViewSurvey = (id: number) => {
      router.push(`/surveys/${id}`);
    };
    return () => {
      delete (window as any).handleViewSurvey;
    };
  }, [router]);

  /**
   * Initialize DataTable with server-side processing configuration
   * Sets up columns, pagination, sorting, and AJAX data loading
   */
  const initializeDataTable = () => {
    console.log('Initializing DataTable...');
    
    if (!tableRef.current) {
      console.error('Table ref is null');
      return;
    }

    // Destroy existing instance if any
    if (dtInstanceRef.current) {
      try {
        dtInstanceRef.current.destroy();
      } catch (e) {
        console.warn('Error destroying existing DataTable:', e);
      }
      dtInstanceRef.current = null;
    }

    const $ = (window as any).jQuery || (window as any).$;
    if (!$ || typeof $.fn.DataTable !== 'function') {
      console.error('jQuery or DataTable function not available');
      return;
    }

    const table = $(tableRef.current as HTMLTableElement);
    if (!table.length) {
      console.error('Table element not found in jQuery');
      return;
    }

    try {
      console.log('Creating DataTable instance...');
      dtInstanceRef.current = table.DataTable({
      // Enable server-side processing for better performance with large datasets
      serverSide: true,
      processing: true,
      
      // AJAX configuration for fetching survey data
      ajax: {
        url: '/api/admin/surveys',
        type: 'GET',
        xhrFields: {
          withCredentials: true
        },
        beforeSend: function(xhr: any) {
          // Send phone as Authorization header for user identification
          const userPhone = localStorage.getItem('user_phone') || '';
          if (userPhone) {
            xhr.setRequestHeader('Authorization', `Bearer ${userPhone}`);
          }
        },
        data: function(d: any) {
          // Add filter parameter to request
          const currentFilter = filterType || 'all';
          d.filter = currentFilter;
          return d;
        },
        error: (xhr: any, error: string, thrown: string) => {
          console.error('Surveys API request failed:', error, thrown);
          console.error('Response:', xhr.responseText);
          console.error('Status:', xhr.status);
        },
        dataSrc: (json: any) => {
          console.log('API response received:', json);
          return json.data || [];
        }
      },
      
      // Column definitions with Marathi titles
      columns: [
        { data: 'id', title: 'ID', width: '80px' },
        { 
          data: 'aadhar_no', 
          title: 'आधार क्रमांक', // Aadhar Number
          render: (data: string) => data || '-'
        },
        { 
          data: 'user_id', 
          title: 'वापरकर्ता ID', // User ID
          render: (data: number) => data || '-'
        },
        { 
          data: 'answer_count', 
          title: 'उत्तरांची संख्या', // Number of Answers
          render: (data: number) => data || 0
        },
        { 
          data: 'status', 
          title: 'स्थिती', // Status
          render: (data: string) => {
            // Display status badge: पूर्ण (Completed) or प्रलंबित (Pending)
            const badge = data === 'Completed' ? 'bg-success' : 'bg-warning';
            const text = data === 'Completed' ? 'पूर्ण' : 'प्रलंबित';
            return `<span class="badge ${badge}">${text}</span>`;
          }
        },
        { 
          data: 'created_at', 
          title: 'तयार केले', // Created At
          render: (data: string) => data || '-'
        },
        { 
          data: 'updated_at', 
          title: 'अपडेट केले', // Updated At
          render: (data: string) => data || '-'
        },
        {
          data: null,
          title: 'क्रिया', // Actions
          orderable: false,
          render: (data: any, type: any, row: any) => {
            // View button that calls global handler
            return `
              <button class="btn btn-sm btn-outline-primary" onclick="window.handleViewSurvey(${row.id})" title="पहा">
                <i class="bi bi-eye"></i>
              </button>
            `;
          }
        }
      ],
      
      // Pagination settings
      pageLength: 25,
      lengthMenu: [[10, 25, 50, 100, -1], [10, 25, 50, 100, 'All']],
      
      // Default sorting: newest surveys first (ID descending)
      order: [[0, 'desc']],
      // Marathi language translations for DataTables UI
      language: {
        search: 'शोधा:', // Search
        lengthMenu: '_MENU_ नोंदी दाखवा', // Show _MENU_ entries
        info: '_START_ ते _END_ पैकी _TOTAL_ नोंदी दाखवत आहे', // Showing _START_ to _END_ of _TOTAL_ entries
        infoEmpty: 'दाखवण्यासाठी नोंदी नाहीत', // No entries to show
        infoFiltered: '(_MAX_ एकूण नोंदींपैकी फिल्टर केलेले)', // (filtered from _MAX_ total entries)
        processing: 'प्रक्रिया करत आहे...', // Processing...
        loadingRecords: 'लोड होत आहे...', // Loading...
        zeroRecords: 'कोणतीही नोंदी आढळली नाहीत', // No records found
        emptyTable: 'टेबलमध्ये डेटा नाही', // No data in table
        paginate: {
          first: 'पहिले', // First
          last: 'शेवटचे', // Last
          next: 'पुढे', // Next
          previous: 'मागे' // Previous
        }
      },
      
      // DOM layout: length menu, filter, table, info, pagination
      dom: "<'row g-2 mb-3'<'col-12 col-md-8'l><'col-12 col-md-4'f>>" +
           "rt" +
           "<'row g-2 mt-3'<'col-12 col-md-5'i><'col-12 col-md-7'p>>",
      });
      console.log('DataTable initialized successfully');
    } catch (e) {
      console.error('Error initializing DataTable:', e);
      initAttemptedRef.current = false; // Allow retry
    }
  };

  /**
   * Effect to check if DataTables is loaded and initialize the table
   * Retries up to 10 times with 300ms delay between attempts
   * Runs when dataTablesLoaded state changes or component mounts
   */
  useEffect(() => {
    console.log('Effect running - dataTablesLoaded:', dataTablesLoaded, 'tableRef:', !!tableRef.current);
    
    if (!tableRef.current) {
      console.log('Table ref not available yet');
      return;
    }

    /**
     * Check if DataTables library is available and initialize
     * @param retries - Number of retry attempts remaining
     */
    const checkAndInit = (retries = 10) => {
      const $ = (window as any).jQuery || (window as any).$;
      const hasDataTable = $ && typeof $.fn.DataTable === 'function';
      
      console.log('Checking DataTables (attempt ' + (11 - retries) + '):', {
        hasJQuery: !!$,
        hasDataTable,
        dataTablesLoaded,
        retriesLeft: retries
      });

      if (hasDataTable && !initAttemptedRef.current) {
        initAttemptedRef.current = true;
        initializeDataTable();
      } else if (!hasDataTable && retries > 0) {
        // Retry after a delay
        setTimeout(() => checkAndInit(retries - 1), 300);
      } else if (retries === 0) {
        console.error('DataTables not available after all retries');
      }
    };

    // Start checking after a short delay
    const timer = setTimeout(() => checkAndInit(), 500);
    return () => {
      clearTimeout(timer);
    };
  }, [dataTablesLoaded]);

  /**
   * Cleanup effect: Destroy DataTable instance on component unmount
   * Prevents memory leaks and ensures proper cleanup
   */
  useEffect(() => {
    return () => {
      if (dtInstanceRef.current) {
        try {
          dtInstanceRef.current.destroy();
        } catch (e) {
          console.warn('Error destroying DataTable on unmount:', e);
        }
        dtInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <>
      {/* Load DataTables JavaScript library from CDN */}
      <Script
        src="https://cdn.datatables.net/1.13.7/js/jquery.dataTables.min.js"
        strategy="afterInteractive"
        onLoad={() => {
          console.log('DataTables JS script loaded via Script component');
          setDataTablesLoaded(true);
        }}
        onError={(e) => {
          console.error('Failed to load DataTables JS:', e);
        }}
        onReady={() => {
          console.log('DataTables JS ready');
        }}
      />
      
      {/* DataTables CSS stylesheets */}
      <link rel="stylesheet" href="https://cdn.datatables.net/1.13.7/css/jquery.dataTables.min.css" />
      <link rel="stylesheet" href="https://cdn.datatables.net/1.13.7/css/dataTables.bootstrap5.min.css" />
      <AdminLayout>
        <div className="container-fluid p-4">
          {/* Page Header */}
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h2 className="mb-0">सर्वेक्षण यादी</h2>
            {/* Filter Dropdown */}
            <div className="d-flex align-items-center gap-3">
              <label className="mb-0 fw-semibold">फिल्टर:</label>
              <select
                className="form-select form-select-sm"
                style={{ minWidth: '200px' }}
                value={filterType}
                onChange={(e) => {
                  setFilterType(e.target.value);
                  // Reload DataTable with new filter
                  if (dtInstanceRef.current) {
                    dtInstanceRef.current.ajax.reload();
                  }
                }}
              >
                {userType?.toLowerCase() === 'verification_officer' ? (
                  <>
                    <option value="all">सर्व</option>
                    <option value="completed">पूर्ण सर्वेक्षण</option>
                    <option value="incomplete">अपूर्ण सर्वेक्षण</option>
                    <option value="assigned_to_me">माझ्याकडे नियुक्त</option>
                  </>
                ) : (
                  <>
                    <option value="all">सर्व</option>
                    <option value="unassigned">अनियुक्त</option>
                    <option value="pending">प्रलंबित</option>
                    <option value="under_review">पुनरावलोकनाखाली</option>
                    <option value="verified">पडताळले</option>
                    <option value="approved">मंजूर</option>
                  </>
                )}
              </select>
            </div>
          </div>

          {/* Survey List Table Card */}
          <div className="card shadow-sm">
            <div className="card-body">
              <div className="table-responsive">
                {/* 
                  DataTables will automatically:
                  - Add search, pagination, and sorting controls
                  - Populate tbody via server-side AJAX
                  - Apply Bootstrap 5 styling
                */}
                <table ref={tableRef} className="table table-striped align-middle" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>आधार क्रमांक</th>
                      <th>वापरकर्ता ID</th>
                      <th>उत्तरांची संख्या</th>
                      <th>स्थिती</th>
                      <th>तयार केले</th>
                      <th>अपडेट केले</th>
                      <th>क्रिया</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* DataTables will populate this via server-side processing */}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </AdminLayout>
    </>
  );
}
