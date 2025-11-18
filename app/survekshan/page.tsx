'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import AdminLayout from '@/components/AdminLayout';

export const dynamic = 'force-dynamic';

export default function SurvekshanPage() {
  const router = useRouter();
  const tableRef = useRef<HTMLTableElement>(null);
  const dtInstanceRef = useRef<any>(null);
  const [dataTablesLoaded, setDataTablesLoaded] = useState(false);
  const initAttemptedRef = useRef(false);

  // Setup global handler for DataTable view action
  useEffect(() => {
    (window as any).handleViewSurvey = (id: number) => {
      router.push(`/surveys/${id}`);
    };
    return () => {
      delete (window as any).handleViewSurvey;
    };
  }, [router]);

  // Initialize DataTable function
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
      serverSide: true,
      processing: true,
      ajax: {
        url: '/api/admin/surveys',
        type: 'GET',
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
      columns: [
        { data: 'id', title: 'ID', width: '80px' },
        { 
          data: 'aadhar_no', 
          title: 'आधार क्रमांक',
          render: (data: string) => data || '-'
        },
        { 
          data: 'user_id', 
          title: 'वापरकर्ता ID',
          render: (data: number) => data || '-'
        },
        { 
          data: 'answer_count', 
          title: 'उत्तरांची संख्या',
          render: (data: number) => data || 0
        },
        { 
          data: 'status', 
          title: 'स्थिती',
          render: (data: string) => {
            const badge = data === 'Completed' ? 'bg-success' : 'bg-warning';
            const text = data === 'Completed' ? 'पूर्ण' : 'प्रलंबित';
            return `<span class="badge ${badge}">${text}</span>`;
          }
        },
        { 
          data: 'created_at', 
          title: 'तयार केले',
          render: (data: string) => data || '-'
        },
        { 
          data: 'updated_at', 
          title: 'अपडेट केले',
          render: (data: string) => data || '-'
        },
        {
          data: null,
          title: 'क्रिया',
          orderable: false,
          render: (data: any, type: any, row: any) => {
            return `
              <button class="btn btn-sm btn-outline-primary" onclick="window.handleViewSurvey(${row.id})" title="पहा">
                <i class="bi bi-eye"></i>
              </button>
            `;
          }
        }
      ],
      pageLength: 25,
      lengthMenu: [[10, 25, 50, 100, -1], [10, 25, 50, 100, 'All']],
      order: [[0, 'desc']], // Sort by ID descending
      language: {
        search: 'शोधा:',
        lengthMenu: '_MENU_ नोंदी दाखवा',
        info: '_START_ ते _END_ पैकी _TOTAL_ नोंदी दाखवत आहे',
        infoEmpty: 'दाखवण्यासाठी नोंदी नाहीत',
        infoFiltered: '(_MAX_ एकूण नोंदींपैकी फिल्टर केलेले)',
        processing: 'प्रक्रिया करत आहे...',
        loadingRecords: 'लोड होत आहे...',
        zeroRecords: 'कोणतीही नोंदी आढळली नाहीत',
        emptyTable: 'टेबलमध्ये डेटा नाही',
        paginate: {
          first: 'पहिले',
          last: 'शेवटचे',
          next: 'पुढे',
          previous: 'मागे'
        }
      },
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

  // Check if DataTables is loaded and initialize
  useEffect(() => {
    console.log('Effect running - dataTablesLoaded:', dataTablesLoaded, 'tableRef:', !!tableRef.current);
    
    if (!tableRef.current) {
      console.log('Table ref not available yet');
      return;
    }

    // Check if DataTables script is loaded
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

  // Cleanup on unmount
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
      <link rel="stylesheet" href="https://cdn.datatables.net/1.13.7/css/jquery.dataTables.min.css" />
      <link rel="stylesheet" href="https://cdn.datatables.net/1.13.7/css/dataTables.bootstrap5.min.css" />
      <AdminLayout>
        <div className="container-fluid p-4">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h2 className="mb-0">सर्वेक्षण यादी</h2>
          </div>

          <div className="card shadow-sm">
            <div className="card-body">
              <div className="table-responsive">
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
