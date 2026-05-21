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

  const paidOrders = orders.filter(o => (o.paid_amount || 0) > 0)
  const totalSpent = paidOrders.reduce((sum, o) => sum + (o.paid_amount || 0), 0)
  const avgOrderValue = paidOrders.length > 0 ? totalSpent / paidOrders.length : 0
  const subjectCounts = {}
  paidOrders.forEach(o => { if (o.subject) subjectCounts[o.subject] = (subjectCounts[o.subject] || 0) + 1 })
  const topSubject = Object.entries(subjectCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'
  const now = new Date()
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    const month = d.toLocaleString('en-US', { month: 'short' })
    const amount = Math.round(paidOrders
      .filter(o => {
        const date = new Date(o.updated_at || o.created_at)
        return date.getFullYear() === d.getFullYear() && date.getMonth() === d.getMonth()
      })
      .reduce((sum, o) => sum + (o.paid_amount || 0), 0) * 100) / 100
    return { month, amount }
  })
  const maxSpend = Math.max(...monthlyData.map(m => m.amount), 1)
  const hasSpendingData = monthlyData.some(m => m.amount > 0)

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
          <div style={{ padding: '20px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Finance</div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>Spending Insights</h3>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Spent</div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px', lineHeight: 1.1 }}>${totalSpent.toFixed(2)}</div>
            </div>
          </div>

          {!hasSpendingData ? (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: '16px', background: 'linear-gradient(135deg,#dcfce7,#bbf7d0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 16px' }}>📊</div>
              <h4 style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>No spending data yet</h4>
              <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>Make your first payment to see insights here.</p>
            </div>
          ) : (
            <div style={{ padding: '24px 24px 0' }}>
              {/* Bar chart */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', height: '120px', marginBottom: '8px' }}>
                {monthlyData.map((m, i) => {
                  const pct = m.amount > 0 ? Math.max((m.amount / maxSpend) * 100, 8) : 0
                  const isMax = m.amount === maxSpend && m.amount > 0
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', height: '100%', justifyContent: 'flex-end' }}>
                      {m.amount > 0 && (
                        <span style={{ fontSize: '10px', fontWeight: 700, color: isMax ? '#16a34a' : '#64748b' }}>${m.amount}</span>
                      )}
                      <div style={{
                        width: '100%',
                        height: m.amount > 0 ? `${pct}%` : '3px',
                        borderRadius: m.amount > 0 ? '6px 6px 4px 4px' : '2px',
                        background: m.amount > 0
                          ? isMax
                            ? 'linear-gradient(180deg, #16a34a 0%, #15803d 100%)'
                            : 'linear-gradient(180deg, #4ade80 0%, #22c55e 100%)'
                          : '#e2e8f0',
                        boxShadow: isMax ? '0 4px 12px rgba(22,163,74,0.35)' : 'none',
                        transition: 'height 0.4s ease',
                      }} />
                    </div>
                  )
                })}
              </div>
              {/* Month labels */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                {monthlyData.map((m, i) => (
                  <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: '11px', fontWeight: 600, color: '#94a3b8' }}>{m.month}</div>
                ))}
              </div>

              {/* Stats row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderTop: '1px solid #f1f5f9', paddingTop: '16px', paddingBottom: '20px' }}>
                <div style={{ textAlign: 'center', borderRight: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Orders Paid</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>{paidOrders.length}</div>
                </div>
                <div style={{ textAlign: 'center', borderRight: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Avg Value</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#16a34a' }}>${avgOrderValue.toFixed(0)}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Top Subject</div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 4px' }}>{topSubject}</div>
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
