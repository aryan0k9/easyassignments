import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import StudentLayout from './StudentLayout'
import { useAuth } from '../../contexts/AuthContext'
import { buildStudentData } from '../../data/student'
import { getMyOrders, subscribeToMyOrders } from '../../lib/orders'

function Dashboard() {
  const { user } = useAuth()
  const data = buildStudentData(user)
  const [orders, setOrders] = useState([])
  const [loadingOrders, setLoadingOrders] = useState(true)
  const [showInProgressModal, setShowInProgressModal] = useState(false)

  useEffect(() => {
    let unsubscribe = null

    async function loadOrders() {
      setLoadingOrders(true)
      const result = await getMyOrders()
      if (result.success) {
        setOrders(result.orders)
      }
      setLoadingOrders(false)
    }

    loadOrders()

    if (user?.id) {
      unsubscribe = subscribeToMyOrders(user.id, () => {
        loadOrders()
      })
    }

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [user?.id])

  const totalOrders = orders.length
  const inProgress = orders.filter(o => ['active', 'in_review', 'pending'].includes(o.status)).length
  const completed = orders.filter(o => o.status === 'completed').length
  const balance = data.walletBalance || 0

  const recentOrders = orders.slice(0, 4)
  const upcomingDeadlines = orders
    .filter(o => o.status !== 'completed' && o.status !== 'cancelled' && o.deadline)
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
    .slice(0, 3)

  const CHART_COLORS = ['#7c3aed','#2563eb','#0891b2','#16a34a','#d97706','#dc2626','#db2777','#f97316','#84cc16','#8b5cf6']
  const paidOrders = orders.filter(o => (o.paid_amount || 0) > 0)
  const totalSpent = paidOrders.reduce((sum, o) => sum + (o.paid_amount || 0), 0)
  const avgOrderValue = paidOrders.length > 0 ? totalSpent / paidOrders.length : 0
  const hasSpendingData = totalSpent > 0

  const subjectBreakdown = Object.entries(
    paidOrders.reduce((acc, o) => {
      const s = o.subject || 'Other'
      if (!acc[s]) acc[s] = { amount: 0, count: 0 }
      acc[s].amount = Math.round((acc[s].amount + (o.paid_amount || 0)) * 100) / 100
      acc[s].count += 1
      return acc
    }, {})
  ).sort((a, b) => b[1].amount - a[1].amount)
   .map(([subject, d], i) => ({
     subject, amount: d.amount, count: d.count,
     color: CHART_COLORS[i % CHART_COLORS.length],
     pct: totalSpent > 0 ? Math.round((d.amount / totalSpent) * 100) : 0
   }))

  // Donut chart geometry
  const R = 62, SW = 22, CX = 90, CY = 90
  const CIRC = 2 * Math.PI * R
  const GAP = subjectBreakdown.length > 1 ? 3 : 0
  let cumLen = 0
  const donutSegments = subjectBreakdown.map(item => {
    const segLen = Math.max((item.amount / totalSpent) * CIRC - GAP, 0)
    const offset = -cumLen
    cumLen += segLen + GAP
    return { ...item, segLen, offset }
  })

  const formatDate = (date) => new Date(date).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  })

  const daysUntil = (date) => {
    const diff = Math.ceil((new Date(date) - new Date()) / (1000 * 60 * 60 * 24))
    if (diff < 0) return 'Overdue'
    if (diff === 0) return 'Today'
    if (diff === 1) return 'Tomorrow'
    return `In ${diff} days`
  }

  // Get first name for personalized greeting
  const firstName = data.profile?.name?.split(' ')[0] || 'there'
  const isNewUser = totalOrders === 0

  if (loadingOrders) {
    return (
      <StudentLayout title="Dashboard">
        {/* Skeleton stat cards */}
        <div className="sp-stats-grid" style={{ marginBottom: '24px' }}>
          {[1,2,3,4].map(i => (
            <div className="sp-stat-card" key={i}>
              <div className="sp-skeleton" style={{ width: '40px', height: '40px', borderRadius: '10px', marginBottom: '12px' }} />
              <div className="sp-skeleton" style={{ width: '60px', height: '32px', marginBottom: '8px' }} />
              <div className="sp-skeleton" style={{ width: '80px', height: '14px' }} />
            </div>
          ))}
        </div>

        {/* Skeleton recent orders + deadlines */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
          {[1,2].map(col => (
            <div className="sp-card" key={col}>
              <div className="sp-card-header" style={{ marginBottom: '8px' }}>
                <div className="sp-skeleton" style={{ width: '140px', height: '18px' }} />
              </div>
              {[1,2,3].map(row => (
                <div key={row} style={{ padding: '14px 24px', borderBottom: '1px solid var(--sp-surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div className="sp-skeleton" style={{ width: '120px', height: '13px', marginBottom: '6px' }} />
                    <div className="sp-skeleton" style={{ width: '80px', height: '12px' }} />
                  </div>
                  <div className="sp-skeleton" style={{ width: '60px', height: '22px', borderRadius: '20px' }} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </StudentLayout>
    )
  }

  return (
    <StudentLayout title="Dashboard">
      {/* Welcome banner for new users */}
      {isNewUser && (
        <div style={{
          background: 'linear-gradient(135deg, #16A34A 0%, #128a3d 100%)',
          color: 'white',
          borderRadius: '16px',
          padding: '32px',
          marginBottom: '24px',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ position: 'absolute', top: '-30%', right: '-5%', fontSize: '180px', opacity: 0.1, pointerEvents: 'none' }}>👋</div>
          <h2 style={{
            fontFamily: 'Fraunces, Georgia, serif',
            fontSize: '32px',
            fontWeight: 700,
            margin: '0 0 8px',
            letterSpacing: '-0.02em'
          }}>
            Welcome to easyassignments, {firstName}! 👋
          </h2>
          <p style={{ fontSize: '16px', opacity: 0.9, margin: '0 0 20px', maxWidth: '600px' }}>
            You're all set! Place your first order and our PhD experts will deliver high-quality work within hours. New customers get a special discount on their first order.
          </p>
          <Link to="/dashboard/new-order" className="sp-btn" style={{
            background: 'white',
            color: '#16A34A',
            padding: '12px 24px',
            borderRadius: '10px',
            fontWeight: 700,
            textDecoration: 'none',
            display: 'inline-block'
          }}>
            🚀 Place Your First Order
          </Link>
        </div>
      )}

      {/* Stat Cards */}
      <div className="sp-stats-grid">
        <Link to="/dashboard/orders" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="sp-stat-card" style={{ cursor: 'pointer' }}>
            <div className="sp-stat-icon green">📦</div>
            <div className="sp-stat-value">{totalOrders}</div>
            <div className="sp-stat-label">Total Orders</div>
          </div>
        </Link>

        <div className="sp-stat-card" style={{ cursor: 'pointer' }} onClick={() => setShowInProgressModal(true)}>
          <div className="sp-stat-icon blue">⚡</div>
          <div className="sp-stat-value">{inProgress}</div>
          <div className="sp-stat-label">In Progress</div>
        </div>

        <Link to="/dashboard/orders?filter=completed" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="sp-stat-card" style={{ cursor: 'pointer' }}>
            <div className="sp-stat-icon purple">✅</div>
            <div className="sp-stat-value">{completed}</div>
            <div className="sp-stat-label">Completed</div>
          </div>
        </Link>

        <Link to="/dashboard/wallet" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="sp-stat-card" style={{ cursor: 'pointer' }}>
            <div className="sp-stat-icon amber">💰</div>
            <div className="sp-stat-value">${balance.toFixed(2)}</div>
            <div className="sp-stat-label">Wallet Balance</div>
          </div>
        </Link>
      </div>

      {/* In Progress Modal */}
      {showInProgressModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
          onClick={() => setShowInProgressModal(false)}
        >
          <div
            style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '560px', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>⚡ In Progress Orders</h3>
              <button onClick={() => setShowInProgressModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#6b7280', lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {orders.filter(o => ['active', 'in_review', 'pending'].includes(o.status)).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 24px', color: '#9ca3af' }}>
                  <div style={{ fontSize: '36px', marginBottom: '12px' }}>⚡</div>
                  <p style={{ fontWeight: 600, margin: 0 }}>No in-progress orders</p>
                </div>
              ) : (
                orders.filter(o => ['active', 'in_review', 'pending'].includes(o.status)).map(order => (
                  <Link
                    key={order.id}
                    to={`/dashboard/orders/${order.id}`}
                    onClick={() => setShowInProgressModal(false)}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', borderBottom: '1px solid #f3f4f6', textDecoration: 'none', color: 'inherit', gap: '12px' }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#6b7280', fontFamily: 'monospace' }}>{order.order_number || order.id}</div>
                      <div style={{ fontSize: '14px', color: '#0f172a', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{order.subject}</div>
                      {order.deadline && (
                        <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>Due: {formatDate(order.deadline)}</div>
                      )}
                    </div>
                    <span className={`sp-status-badge ${order.status}`}>{order.status.replace('_', ' ')}</span>
                  </Link>
                ))
              )}
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb' }}>
              <Link to="/dashboard/orders" onClick={() => setShowInProgressModal(false)} style={{ display: 'block', textAlign: 'center', padding: '10px', background: '#16a34a', color: 'white', borderRadius: '8px', textDecoration: 'none', fontWeight: 600, fontSize: '14px' }}>
                View All Orders →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Recent Orders + Upcoming Deadlines */}
      <div className="sp-dash-mid-grid">
        <div className="sp-card">
          <div className="sp-card-header">
            <h3 className="sp-card-title">📦 Recent Orders</h3>
            {recentOrders.length > 0 && (
              <Link to="/dashboard/orders" className="sp-card-link">View All →</Link>
            )}
          </div>
          {recentOrders.length === 0 ? (
            <div className="sp-empty">
              <div className="sp-empty-icon">📦</div>
              <h4>No orders yet</h4>
              <p>Place your first order to get started with easyassignments.</p>
              <Link to="/dashboard/new-order" className="sp-btn sp-btn-primary">Place Order →</Link>
            </div>
          ) : (
            <div>
              {recentOrders.map((order) => (
                <Link key={order.id} to={`/dashboard/orders/${order.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '14px 24px', borderBottom: '1px solid var(--sp-surface)', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="sp-order-id">{order.order_number?.replace('EA-', '') || order.id}</div>
                    <div style={{ fontSize: '14px', color: 'var(--sp-charcoal)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{order.subject}</div>
                  </div>
                  <span className={`sp-status-badge ${order.status}`}>{order.status}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="sp-card">
          <div className="sp-card-header">
            <h3 className="sp-card-title">📅 Upcoming Deadlines</h3>
            {upcomingDeadlines.length > 0 && (
              <Link to="/dashboard/deadlines" className="sp-card-link">View All →</Link>
            )}
          </div>
          {upcomingDeadlines.length === 0 ? (
            <div className="sp-empty">
              <div className="sp-empty-icon">📅</div>
              <h4>No upcoming deadlines</h4>
              <p>You're all caught up! Place an order to track deadlines here.</p>
            </div>
          ) : (
            <div>
              {upcomingDeadlines.map((order) => (
                <div key={order.id} style={{ padding: '14px 24px', borderBottom: '1px solid var(--sp-surface)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <div className="sp-order-id">{order.order_number?.replace('EA-', '') || order.id}</div>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: daysUntil(order.deadline) === 'Overdue' ? 'var(--sp-red)' : 'var(--sp-amber)' }}>
                      {daysUntil(order.deadline)}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--sp-charcoal)' }}>{order.subject} · {formatDate(order.deadline)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Spending Chart + Referral */}
      <div className="sp-dash-bottom-grid">
        <div className="sp-card" style={{ overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ padding: '20px 24px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}>
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>📊 Spending Insights</h3>
            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>
              Total: <strong style={{ color: '#16a34a' }}>${totalSpent.toFixed(2)}</strong>
            </span>
          </div>

          {!hasSpendingData ? (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
              <h4 style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>No spending data yet</h4>
              <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>Make your first payment to see insights here.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 0 }}>
              {/* Donut chart */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 8px 20px 16px' }}>
                <svg width="180" height="180" viewBox="0 0 180 180">
                  {/* Background ring */}
                  <circle cx={CX} cy={CY} r={R} fill="none" stroke="#f1f5f9" strokeWidth={SW} />
                  {/* Segments */}
                  {donutSegments.map((seg, i) => (
                    <circle key={i} cx={CX} cy={CY} r={R} fill="none"
                      stroke={seg.color} strokeWidth={SW}
                      strokeDasharray={`${seg.segLen} ${CIRC - seg.segLen}`}
                      strokeDashoffset={seg.offset}
                      style={{ transform: 'rotate(-90deg)', transformOrigin: `${CX}px ${CY}px` }}
                      strokeLinecap="butt"
                    />
                  ))}
                  {/* Center text */}
                  <text x={CX} y={CY - 10} textAnchor="middle" fontSize="11" fontWeight="600" fill="#94a3b8">Money spent</text>
                  <text x={CX} y={CY + 12} textAnchor="middle" fontSize="19" fontWeight="800" fill="#0f172a">${totalSpent.toFixed(0)}</text>
                  <text x={CX} y={CY + 28} textAnchor="middle" fontSize="11" fill="#16a34a" fontWeight="700">{paidOrders.length} order{paidOrders.length !== 1 ? 's' : ''}</text>
                </svg>
                {/* Avg */}
                <div style={{ textAlign: 'center', marginTop: 4 }}>
                  <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Avg per order</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>${avgOrderValue.toFixed(2)}</div>
                </div>
              </div>

              {/* Breakdown list */}
              <div style={{ borderLeft: '1px solid #f1f5f9', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px 8px', fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Spending breakdown
                </div>
                <div style={{ overflowY: 'auto', maxHeight: '240px' }}>
                  {subjectBreakdown.map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', borderBottom: '1px solid #f8fafc' }}>
                      {/* Color dot */}
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.subject}</div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: 1 }}>{item.count} order{item.count !== 1 ? 's' : ''}</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>${item.amount.toFixed(2)}</div>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: item.color }}>{item.pct}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="sp-referral-card">
          <h3>Refer & Earn</h3>
          <p>Share your code and earn $15 for every friend who signs up.</p>
          <div className="sp-referral-code" onClick={() => {
            navigator.clipboard.writeText(data.referral?.code || '')
            alert('Code copied!')
          }}>
            {data.referral?.code || 'CODE'}
          </div>
          <div className="sp-referral-stats">
            <div>
              <div className="sp-referral-stat-num">{data.referral?.referred || 0}</div>
              <div className="sp-referral-stat-label">Referred</div>
            </div>
            <div>
              <div className="sp-referral-stat-num">${data.referral?.earned || 0}</div>
              <div className="sp-referral-stat-label">Earned</div>
            </div>
            <div>
              <div className="sp-referral-stat-num">${data.referral?.pending || 0}</div>
              <div className="sp-referral-stat-label">Pending</div>
            </div>
          </div>
        </div>
      </div>
    </StudentLayout>
  )
}

export default Dashboard
