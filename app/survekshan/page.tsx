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
  const [surveysData, setSurveysData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Get user type on mount
  useEffect(() => {
    const storedUserType = localStorage.getItem('user_type') || '';
    setUserType(storedUserType);
  }, []);

  // Fetch all surveys data once on mount
  useEffect(() => {
    const fetchSurveys = async () => {
      try {
        setLoading(true);
        const userPhone = localStorage.getItem('user_phone') || '';
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
        };
        if (userPhone) {
          headers['Authorization'] = `Bearer ${userPhone}`;
        }

        // Fetch all surveys without pagination for client-side processing
        const response = await fetch(`/api/admin/surveys?filter=${filterType}&start=0&length=999999&draw=1`, {
          method: 'GET',
          headers,
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const json = await response.json();
        if (json.data && Array.isArray(json.data)) {
          setSurveysData(json.data);
        } else {
          setSurveysData([]);
        }
      } catch (error) {
        console.error('Error fetching surveys:', error);
        setSurveysData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSurveys();
  }, [filterType]);

  // Re-initialize DataTable when data changes (after filter change)
  useEffect(() => {
    if (surveysData.length >= 0 && !loading && dataTablesLoaded) {
      // Reset initialization flag to allow re-initialization with new data
      if (dtInstanceRef.current) {
        try {
          dtInstanceRef.current.destroy();
        } catch (e) {
          console.warn('Error destroying DataTable:', e);
        }
        dtInstanceRef.current = null;
      }
      initAttemptedRef.current = false;
      // Trigger re-initialization
      const timer = setTimeout(() => {
        if (tableRef.current && !initAttemptedRef.current) {
          initializeDataTable();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [surveysData, loading, dataTablesLoaded]);

  /**
   * Setup global handler for DataTable view action button
   * This allows the dynamically rendered buttons in DataTable to navigate to survey details
   */
  useEffect(() => {
    // Ensure handleViewSurvey is always available before DataTable tries to use it
    (window as any).handleViewSurvey = (id: number) => {
      if (router) {
        router.push(`/surveys/${id}`);
      }
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
      // Client-side processing - DataTables handles search, sort, pagination
      data: surveysData,
      
      // Column definitions with Marathi titles
      columns: [
        { data: 'id', title: 'ID', width: '80px' },
        { 
          data: 'aadhar_no', 
          title: 'आधार क्रमांक', // Aadhar Number
          render: (data: string) => data || '-'
        },
        { 
          data: null,
          title: 'वापरकर्ता', // User (Field Officer)
          orderable: true,
          render: (data: any, type: string, row: any) => {
            if (row.user_name || row.user_phone) {
              const name = row.user_name || `ID: ${row.user_id}`;
              const phone = row.user_phone ? ` (${row.user_phone})` : '';
              return name + phone;
            }
            return row.user_id ? `ID: ${row.user_id}` : '-';
          }
        },
        { 
          data: 'source', 
          title: 'स्रोत', // Source
          render: (data: string) => {
            if (!data) return '-';
            // Translate common source values to Marathi
            const sourceMap: { [key: string]: string } = {
              'Divyang Self': 'दिव्यांग स्वतः',
              'Field Officer App': 'फील्ड ऑफिसर अॅप',
              'Public URL': 'सार्वजनिक URL',
              'Mobile App': 'मोबाइल अॅप',
            };
            return sourceMap[data] || data;
          }
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
            // View button that calls global handler with safety check
            return `
              <button class="btn btn-sm btn-outline-primary" onclick="if(window.handleViewSurvey && typeof window.handleViewSurvey === 'function'){window.handleViewSurvey(${row.id});}else{console.error('handleViewSurvey not available');}" title="पहा">
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
   * Runs when dataTablesLoaded state changes, data is loaded, or component mounts
   */
  useEffect(() => {
    console.log('Effect running - dataTablesLoaded:', dataTablesLoaded, 'tableRef:', !!tableRef.current, 'loading:', loading, 'dataLength:', surveysData.length);
    
    if (!tableRef.current || loading) {
      console.log('Table ref not available yet or still loading data');
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
        retriesLeft: retries,
        dataReady: !loading && surveysData.length >= 0
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
  }, [dataTablesLoaded, loading, surveysData.length]);

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
      
      <AdminLayout>
        <div className="container-fluid p-4">
          {/* Page Header */}
          <div className="survekshan-header d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4 gap-3 gap-md-0">
            <h2 className="mb-0">सर्वेक्षण यादी</h2>
            {/* Filter Dropdown */}
            <div className="survekshan-filter d-flex flex-column flex-md-row align-items-start align-items-md-center gap-2 gap-md-3 w-100 w-md-auto">
              <label className="mb-0 fw-semibold">फिल्टर:</label>
              <select
                className="form-select form-select-sm"
                style={{ minWidth: '200px', width: '100%' }}
                value={filterType}
                onChange={(e) => {
                  setFilterType(e.target.value);
                  // Filter change will trigger data refetch via useEffect
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
              {loading ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">लोड होत आहे...</span>
                  </div>
                  <p className="mt-2">डेटा लोड होत आहे...</p>
                </div>
              ) : (
                <div className="table-responsive">
                  {/* 
                    DataTables will automatically:
                    - Add search, pagination, and sorting controls (client-side)
                    - Populate tbody from the data prop
                    - Apply Bootstrap 5 styling
                  */}
                  <table ref={tableRef} className="table table-striped align-middle" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>आधार क्रमांक</th>
                        <th>वापरकर्ता</th>
                        <th>स्रोत</th>
                        <th>उत्तरांची संख्या</th>
                        <th>स्थिती</th>
                        <th>तयार केले</th>
                        <th>अपडेट केले</th>
                        <th>क्रिया</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* DataTables will populate this from the data prop */}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </AdminLayout>
    </>
  );
}
