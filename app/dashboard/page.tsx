'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/AdminLayout';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

// Color palette for charts
const CHART_COLORS = {
  primary: [
    'rgba(13, 71, 161, 0.9)',   // Deep Blue
    'rgba(25, 118, 210, 0.9)',  // Blue
    'rgba(66, 165, 245, 0.9)',  // Light Blue
    'rgba(123, 31, 162, 0.9)',  // Purple
    'rgba(156, 39, 176, 0.9)',  // Light Purple
    'rgba(0, 105, 92, 0.9)',    // Teal
    'rgba(0, 150, 136, 0.9)',   // Light Teal
    'rgba(255, 152, 0, 0.9)',   // Orange
    'rgba(255, 193, 7, 0.9)',   // Amber
    'rgba(244, 67, 54, 0.9)',   // Red
    'rgba(233, 30, 99, 0.9)',   // Pink
    'rgba(76, 175, 80, 0.9)',   // Green
  ],
  borders: [
    'rgba(13, 71, 161, 1)',
    'rgba(25, 118, 210, 1)',
    'rgba(66, 165, 245, 1)',
    'rgba(123, 31, 162, 1)',
    'rgba(156, 39, 176, 1)',
    'rgba(0, 105, 92, 1)',
    'rgba(0, 150, 136, 1)',
    'rgba(255, 152, 0, 1)',
    'rgba(255, 193, 7, 1)',
    'rgba(244, 67, 54, 1)',
    'rgba(233, 30, 99, 1)',
    'rgba(76, 175, 80, 1)',
  ],
  gender: {
    male: 'rgba(13, 71, 161, 0.9)',
    female: 'rgba(233, 30, 99, 0.9)',
    other: 'rgba(76, 175, 80, 0.9)',
  },
  genderBorders: {
    male: 'rgba(13, 71, 161, 1)',
    female: 'rgba(233, 30, 99, 1)',
    other: 'rgba(76, 175, 80, 1)',
  },
};

// Helper to get colors for multiple items
const getColorsForItems = (count: number) => {
  const colors = [];
  const borders = [];
  for (let i = 0; i < count; i++) {
    colors.push(CHART_COLORS.primary[i % CHART_COLORS.primary.length]);
    borders.push(CHART_COLORS.borders[i % CHART_COLORS.borders.length]);
  }
  return { colors, borders };
};

type Stats = {
  totalSurveys: number;
  surveysToday: number;
  totalAnswers: number;
  pendingSurveys: number;
  completionRate: number;
  otpToday: { sent: number; verified: number };
  activeQuestions: number;
  breakdowns?: {
    taluka: { name: string; completed: number }[];
    gender: { name: string; completed: number }[];
    district: { name: string; completed: number }[];
    pendingOverall: number;
    ageRanges?: { label: string; male: number; female: number; other: number; total: number }[];
  };
};

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sections, setSections] = useState<string[]>([]);

  const handleStartSurvey = () => {
    router.push('/survekshan');
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch('/api/admin/stats', { cache: 'no-store' });
        const json = await res.json();
        if (json.ok) {
          setStats(json.data);
          if (Array.isArray(json.data?.sections)) setSections(json.data.sections);
        }
        else setError(json.error || 'स्टॅट्स लोड होत नाहीत');
      } catch (e: any) {
        setError('नेटवर्क त्रुटी');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const StatCard = ({ title, value, subtitle, delay = '0s' }: { title: string; value: string | number; subtitle?: string; delay?: string }) => (
    <div className="col-12 col-sm-6 col-lg-4 col-xxl-3">
      <div className="card h-100 animate__animated animate__fadeInUp" style={{ animationDelay: delay }}>
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center">
            <h6 className="mb-2 text-muted">{title}</h6>
            <i className="bi bi-graph-up"></i>
          </div>
          <div className="display-6 fw-bold" style={{ lineHeight: 1.1 }}>{value}</div>
          {subtitle ? <div className="text-muted mt-2 small">{subtitle}</div> : null}
        </div>
      </div>
    </div>
  );

  return (
    <AdminLayout>
      <div className="container-fluid">
        <h1 className="title mb-4 animate__animated animate__fadeInDown">डॅशबोर्ड</h1>

        {error && (
          <div className="alert alert-danger mb-3">{error}</div>
        )}

        <div className="row g-3 mb-4">
          <StatCard title="एकूण सर्वेक्षण" value={stats?.totalSurveys ?? (loading ? '...' : 0)} delay="0.0s" />
          <StatCard title="आजचे सर्वेक्षण" value={stats?.surveysToday ?? (loading ? '...' : 0)} delay="0.05s" />
          <StatCard title="पूर्णता दर" value={stats ? `${stats.completionRate}%` : (loading ? '...' : '0%')} subtitle="पूर्ण सबमिट झालेले" delay="0.1s" />
          <StatCard title="प्रलंबित" value={stats?.pendingSurveys ?? (loading ? '...' : 0)} delay="0.15s" />
          <StatCard title="उत्तरांची संख्या" value={stats?.totalAnswers ?? (loading ? '...' : 0)} delay="0.2s" />
          <StatCard title="प्रश्नावली विभाग" value={sections?.length ?? (loading ? '...' : 0)} delay="0.22s" />
          <StatCard title="सक्रिय प्रश्न" value={stats?.activeQuestions ?? (loading ? '...' : 0)} delay="0.24s" />
          {/* OTP आज पाठवले card removed; sections count card added above */}
          {/* Removed OTP पडताळले card; replaced by sections list below */}
        </div>

        {/* Charts Section */}
        <div className="row g-4 mb-4">
          {/* Taluka Breakdown Chart */}
          <div className="col-12 col-lg-6">
            <div className="card h-100 animate__animated animate__fadeInUp" style={{ animationDelay: '0.3s' }}>
              <div className="card-body">
                <h5 className="card-title mb-3">तालुका निहाय</h5>
                {stats?.breakdowns?.taluka && stats.breakdowns.taluka.length > 0 ? (
                  <Bar
                    data={{
                      labels: stats.breakdowns.taluka.map(t => t.name),
                      datasets: [{
                        label: 'पूर्ण सर्वेक्षण',
                        data: stats.breakdowns.taluka.map(t => t.completed),
                        backgroundColor: getColorsForItems(stats.breakdowns.taluka.length).colors,
                        borderColor: getColorsForItems(stats.breakdowns.taluka.length).borders,
                        borderWidth: 2,
                        borderRadius: 6,
                        borderSkipped: false,
                      }],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: true,
                      plugins: {
                        legend: {
                          display: false,
                        },
                        tooltip: {
                          backgroundColor: 'rgba(0, 0, 0, 0.8)',
                          padding: 12,
                          titleFont: { size: 14, weight: 'bold' },
                          bodyFont: { size: 13 },
                          callbacks: {
                            label: function(context) {
                              return `पूर्ण: ${context.parsed.y}`;
                            }
                          }
                        }
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                          ticks: {
                            stepSize: 1,
                            font: { size: 11 },
                          },
                          grid: {
                            color: 'rgba(0, 0, 0, 0.05)',
                          }
                        },
                        x: {
                          ticks: {
                            font: { size: 11 },
                            maxRotation: 45,
                            minRotation: 0,
                          },
                          grid: {
                            display: false,
                          }
                        }
                      }
                    }}
                  />
                ) : (
                  <div className="text-center py-5">
                    <p className="text-muted mb-0">डेटा उपलब्ध नाही</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Gender Breakdown Chart */}
          <div className="col-12 col-lg-6">
            <div className="card h-100 animate__animated animate__fadeInUp" style={{ animationDelay: '0.35s' }}>
              <div className="card-body">
                <h5 className="card-title mb-3">लिंग निहाय</h5>
                {stats?.breakdowns?.gender && stats.breakdowns.gender.length > 0 ? (
                  <div style={{ height: '300px', position: 'relative' }}>
                    <Doughnut
                      data={{
                        labels: stats.breakdowns.gender.map(g => g.name),
                        datasets: [{
                          data: stats.breakdowns.gender.map(g => g.completed),
                          backgroundColor: stats.breakdowns.gender.map((g, i) => {
                            const name = g.name.toLowerCase();
                            if (name.includes('पुरुष') || name.includes('male')) return CHART_COLORS.gender.male;
                            if (name.includes('स्त्री') || name.includes('female')) return CHART_COLORS.gender.female;
                            return CHART_COLORS.gender.other;
                          }),
                          borderColor: stats.breakdowns.gender.map((g, i) => {
                            const name = g.name.toLowerCase();
                            if (name.includes('पुरुष') || name.includes('male')) return CHART_COLORS.genderBorders.male;
                            if (name.includes('स्त्री') || name.includes('female')) return CHART_COLORS.genderBorders.female;
                            return CHART_COLORS.genderBorders.other;
                          }),
                          borderWidth: 3,
                          hoverOffset: 8,
                        }],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: '60%',
                        plugins: {
                          legend: {
                            position: 'bottom',
                            labels: {
                              padding: 15,
                              font: { size: 12 },
                              usePointStyle: true,
                              pointStyle: 'circle',
                            }
                          },
                          tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            padding: 12,
                            titleFont: { size: 14, weight: 'bold' },
                            bodyFont: { size: 13 },
                            callbacks: {
                              label: function(context) {
                                const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                                const percentage = total > 0 ? ((context.parsed / total) * 100).toFixed(1) : 0;
                                return `${context.label}: ${context.parsed} (${percentage}%)`;
                              }
                            }
                          }
                        }
                      }}
                    />
                  </div>
                ) : (
                  <div className="text-center py-5">
                    <p className="text-muted mb-0">डेटा उपलब्ध नाही</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* District Breakdown Chart */}
          <div className="col-12 col-lg-6">
            <div className="card h-100 animate__animated animate__fadeInUp" style={{ animationDelay: '0.4s' }}>
              <div className="card-body">
                <h5 className="card-title mb-3">जिल्हा निहाय</h5>
                {stats?.breakdowns?.district && stats.breakdowns.district.length > 0 ? (
                  <Bar
                    data={{
                      labels: stats.breakdowns.district.map(d => d.name.length > 20 ? d.name.substring(0, 20) + '...' : d.name),
                      datasets: [{
                        label: 'पूर्ण सर्वेक्षण',
                        data: stats.breakdowns.district.map(d => d.completed),
                        backgroundColor: getColorsForItems(stats.breakdowns.district.length).colors,
                        borderColor: getColorsForItems(stats.breakdowns.district.length).borders,
                        borderWidth: 2,
                        borderRadius: 6,
                        borderSkipped: false,
                      }],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: true,
                      indexAxis: 'y',
                      plugins: {
                        legend: {
                          display: false,
                        },
                        tooltip: {
                          backgroundColor: 'rgba(0, 0, 0, 0.8)',
                          padding: 12,
                          titleFont: { size: 14, weight: 'bold' },
                          bodyFont: { size: 13 },
                          callbacks: {
                            title: function(context) {
                              const fullName = stats.breakdowns?.district?.[context[0].dataIndex]?.name || '';
                              return fullName;
                            },
                            label: function(context) {
                              return `पूर्ण: ${context.parsed.x}`;
                            }
                          }
                        }
                      },
                      scales: {
                        x: {
                          beginAtZero: true,
                          ticks: {
                            stepSize: 1,
                            font: { size: 11 },
                          },
                          grid: {
                            color: 'rgba(0, 0, 0, 0.05)',
                          }
                        },
                        y: {
                          ticks: {
                            font: { size: 11 },
                          },
                          grid: {
                            display: false,
                          }
                        }
                      }
                    }}
                  />
                ) : (
                  <div className="text-center py-5">
                    <p className="text-muted mb-0">डेटा उपलब्ध नाही</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Age Ranges Chart */}
          <div className="col-12 col-lg-6">
            <div className="card h-100 animate__animated animate__fadeInUp" style={{ animationDelay: '0.45s' }}>
              <div className="card-body">
                <h5 className="card-title mb-3">वयोगटानुसार</h5>
                {(stats as any)?.breakdowns?.ageRanges && (stats as any).breakdowns.ageRanges.length > 0 ? (
                  <Bar
                    data={{
                      labels: (stats as any).breakdowns.ageRanges.map((r: any) => r.label),
                      datasets: [
                        {
                          label: 'पुरुष',
                          data: (stats as any).breakdowns.ageRanges.map((r: any) => r.male || 0),
                          backgroundColor: CHART_COLORS.gender.male,
                          borderColor: CHART_COLORS.genderBorders.male,
                          borderWidth: 2,
                          borderRadius: 6,
                          borderSkipped: false,
                        },
                        {
                          label: 'स्त्री',
                          data: (stats as any).breakdowns.ageRanges.map((r: any) => r.female || 0),
                          backgroundColor: CHART_COLORS.gender.female,
                          borderColor: CHART_COLORS.genderBorders.female,
                          borderWidth: 2,
                          borderRadius: 6,
                          borderSkipped: false,
                        },
                        {
                          label: 'इतर',
                          data: (stats as any).breakdowns.ageRanges.map((r: any) => r.other || 0),
                          backgroundColor: CHART_COLORS.gender.other,
                          borderColor: CHART_COLORS.genderBorders.other,
                          borderWidth: 2,
                          borderRadius: 6,
                          borderSkipped: false,
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: true,
                      plugins: {
                        legend: {
                          position: 'top',
                          labels: {
                            padding: 15,
                            font: { size: 12 },
                            usePointStyle: true,
                            pointStyle: 'circle',
                          }
                        },
                        tooltip: {
                          backgroundColor: 'rgba(0, 0, 0, 0.8)',
                          padding: 12,
                          titleFont: { size: 14, weight: 'bold' },
                          bodyFont: { size: 13 },
                          callbacks: {
                            footer: function(tooltipItems) {
                              const total = tooltipItems.reduce((sum: number, item: any) => {
                                return sum + (item.parsed.y || 0);
                              }, 0);
                              return `एकूण: ${total}`;
                            }
                          }
                        }
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                          ticks: {
                            stepSize: 1,
                            font: { size: 11 },
                          },
                          grid: {
                            color: 'rgba(0, 0, 0, 0.05)',
                          }
                        },
                        x: {
                          ticks: {
                            font: { size: 11 },
                          },
                          grid: {
                            display: false,
                          }
                        }
                      }
                    }}
                  />
                ) : (
                  <div className="text-center py-5">
                    <p className="text-muted mb-0">डेटा उपलब्ध नाही</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Section removed as requested: survey start and sections list cards */}

        <div className="row g-4 mt-1">
          <div className="col-12 col-xl-4">
            <div className="card h-100 animate__animated animate__fadeInUp" style={{ animationDelay: '0.45s' }}>
              <div className="card-body">
                <h5 className="card-title">तालुका निहाय (Completed)</h5>
                {!stats?.breakdowns?.taluka?.length ? (
                  <p className="text-muted mb-0">डेटा उपलब्ध नाही</p>
                ) : (
                  <ul className="list-group list-group-flush">
                    {stats.breakdowns.taluka.slice(0, 10).map((t, i) => (
                      <li key={`tal-${i}`} className="list-group-item d-flex justify-content-between">
                        <span>{t.name}</span>
                        <span className="badge bg-success">{t.completed}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <small className="text-muted d-block mt-2">Pending (overall): {stats?.breakdowns?.pendingOverall ?? 0}</small>
              </div>
            </div>
          </div>
          <div className="col-12 col-xl-4">
            <div className="card h-100 animate__animated animate__fadeInUp" style={{ animationDelay: '0.5s' }}>
              <div className="card-body">
                <h5 className="card-title">जिल्हा (Completed)</h5>
                {!stats?.breakdowns?.district?.length ? (
                  <p className="text-muted mb-0">डेटा उपलब्ध नाही</p>
                ) : (
                  <ul className="list-group list-group-flush">
                    {stats.breakdowns.district.slice(0, 10).map((d, i) => (
                      <li key={`dist-${i}`} className="list-group-item d-flex justify-content-between">
                        <span>{d.name}</span>
                        <span className="badge bg-success">{d.completed}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
          <div className="col-12 col-xl-4">
            <div className="card h-100 animate__animated animate__fadeInUp" style={{ animationDelay: '0.55s' }}>
              <div className="card-body">
                <h5 className="card-title">लिंग (Completed)</h5>
                {!stats?.breakdowns?.gender?.length ? (
                  <p className="text-muted mb-0">डेटा उपलब्ध नाही</p>
                ) : (
                  <ul className="list-group list-group-flush">
                    {stats.breakdowns.gender.slice(0, 10).map((g, i) => (
                      <li key={`gen-${i}`} className="list-group-item d-flex justify-content-between">
                        <span>{g.name}</span>
                        <span className="badge bg-success">{g.completed}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
          <div className="col-12 mt-3">
            <div className="card animate__animated animate__fadeInUp" style={{ animationDelay: '0.6s' }}>
              <div className="card-body">
                <h5 className="card-title">वयोगटानुसार</h5>
                {!((stats as any)?.breakdowns?.ageRanges?.length) ? (
                  <p className="text-muted mb-0">डेटा उपलब्ध नाही</p>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-striped table-sm mb-0">
                      <thead>
                        <tr>
                          <th>वयोगट</th>
                          <th>पुरुष</th>
                          <th>स्त्री</th>
                          <th>इतर</th>
                          <th>एकूण</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(stats as any).breakdowns.ageRanges.map((r: any, i: number) => (
                          <tr key={`age-${i}`}>
                            <td>{r.label}</td>
                            <td>{r.male}</td>
                            <td>{r.female}</td>
                            <td>{r.other}</td>
                            <td>{r.total}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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

