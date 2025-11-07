'use client';

import React, { useEffect, useRef } from 'react';
import AdminLayout from '@/components/AdminLayout';
import $ from 'jquery';

export const dynamic = 'force-dynamic';

export default function SurvekshanPage() {
  const tableRef = useRef<HTMLTableElement>(null);
  const dtInstanceRef = useRef<any>(null);

  // Setup global handler for DataTable view action
  useEffect(() => {
    (window as any).handleViewSurvey = (id: number) => {
      // Navigate to view survey details - can be implemented later
      alert(`View survey ${id} - Details page to be implemented`);
    };
    return () => {
      delete (window as any).handleViewSurvey;
    };
  }, []);

  useEffect(() => {
    if (!tableRef.current) return;

    // Destroy existing instance if any
    if (dtInstanceRef.current) {
      dtInstanceRef.current.destroy();
      dtInstanceRef.current = null;
    }

    // Ensure jQuery globals for plugin
    (window as any).$ = $;
    (window as any).jQuery = $;

    // Dynamically import DataTables (Bootstrap 5)
    (async () => {
      try {
        const mod: any = await import('datatables.net-bs5');
        if (typeof mod === 'function') {
          try { mod(window, $); } catch {}
        } else if (mod?.default) {
          try { mod.default(window, $); } catch {}
        }
      } catch (e) {
        console.error('Failed to load DataTables plugin', e);
      }

      const table = $(tableRef.current as HTMLTableElement);
      dtInstanceRef.current = table.DataTable({
      serverSide: true,
      processing: true,
      ajax: {
        url: '/api/admin/surveys',
        type: 'GET',
        error: (xhr: any, error: string, thrown: string) => {
          console.error('Surveys API request failed:', error, thrown);
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
    })();

    return () => {
      if (dtInstanceRef.current) {
        dtInstanceRef.current.destroy();
        dtInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <>
      <link rel="stylesheet" href="https://cdn.datatables.net/1.13.7/css/jquery.dataTables.min.css" />
      <link rel="stylesheet" href="https://cdn.datatables.net/1.13.7/css/dataTables.bootstrap5.min.css" />
      <AdminLayout>
        <div className="container-fluid p-4">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h2 className="mb-0">सर्वेक्षण सूची</h2>
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
