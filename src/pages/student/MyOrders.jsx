import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import StudentLayout from './StudentLayout'
import { useAuth } from '../../contexts/AuthContext'
import { getMyOrders, subscribeToMyOrders } from '../../lib/orders'
import { supabase } from '../../lib/supabase'

// Order can be deleted only if no work started and no payment made
function canDelete(order) {
  return (order.status === 'pending' || order.status === 'in_review') &&
    order.payment_status === 'unpaid'
}

function MyOrders() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState(searchParams.get('filter') || 'all')
  const [orderUnreads, setOrderUnreads] = useState({})
  const [deleteConfirm, setDeleteConfirm] = useState(null) // order to confirm
  const [deleting, setDeleting] = useState(false)

  // Load orders + subscribe to real-time updates
  useEffect(() => {
    let unsubscribe = null

    async function loadOrders() {
      setLoading(true)
      const result = await getMyOrders()
      if (result.success) {
        setOrders(result.orders)
      } else {
        setError(result.error || 'Failed to load orders')
      }
      setLoading(false)
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

  // Fetch unread counts per order
  useEffect(() => {
    if (!user?.id || orders.length === 0) return
    fetchOrderUnreads()

    // Listen for new messages to update badge
    const ch = supabase.channel('order-unread-listener')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, () => {
        fetchOrderUnreads()
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [user?.id, orders.length])

  async function deleteOrder(order) {
    setDeleting(true)
    try {
      // Delete associated chat sessions (and their messages via cascade)
      await supabase.from('chat_sessions').delete().eq('order_id', order.id)
      // Delete the order itself
      await supabase.from('orders').delete().eq('id', order.id).eq('user_id', user.id)
      setOrders(prev => prev.filter(o => o.id !== order.id))
    } catch (err) {
      setError('Failed to delete order. Please try again.')
    } finally {
      setDeleting(false)
      setDeleteConfirm(null)
    }
  }

  async function fetchOrderUnreads() {
    // Get all order chat sessions for this user
    const { data: sessions } = await supabase
      .from('chat_sessions')
      .select('id, order_id')
      .eq('chat_type', 'order')
      .eq('user_id', user.id)

    if (!sessions || sessions.length === 0) return

    // For each session, count unread admin messages
    const unreads = {}
    for (const s of sessions) {
      const { count } = await supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', s.id)
        .eq('sender_type', 'admin')
        .eq('read', false)
      if (count > 0) unreads[s.order_id] = count
    }
    setOrderUnreads(unreads)
  }

  // Filter logic
  const filteredOrders = useMemo(() => {
    if (filter === 'all') return orders
    if (filter === 'active') return orders.filter(o => o.status === 'active' || o.status === 'in_review')
    return orders.filter(o => o.status === filter)
  }, [orders, filter])

  // Counts for filter tabs
  const counts = useMemo(() => ({
    all:       orders.length,
    pending:   orders.filter(o => o.status === 'pending').length,
    active:    orders.filter(o => o.status === 'active' || o.status === 'in_review').length,
    completed: orders.filter(o => o.status === 'completed').length,
    cancelled: orders.filter(o => o.status === 'cancelled').length
  }), [orders])

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  }

  const filters = [
    { key: 'all',       label: 'All',       count: counts.all },
    { key: 'pending',   label: 'Pending',   count: counts.pending },
    { key: 'active',    label: 'Active',    count: counts.active },
    { key: 'completed', label: 'Completed', count: counts.completed },
    { key: 'cancelled', label: 'Cancelled', count: counts.cancelled }
  ]

  // Loading state
  if (loading) {
    return (
      <StudentLayout title="My Orders">
        <div className="sp-card">
          <div style={{ padding: '60px 24px', textAlign: 'center' }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '4px solid #E5E7EB',
              borderTopColor: '#16A34A',
              borderRadius: '50%',
              margin: '0 auto 16px',
              animation: 'spin 1s linear infinite'
            }}></div>
            <p style={{ color: 'var(--sp-muted)' }}>Loading your orders...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        </div>
      </StudentLayout>
    )
  }

  return (
    <StudentLayout title="My Orders">
      {/* Filter tabs */}
      <div className="sp-card">
        <div className="sp-card-body" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                padding: '6px 14px',
                borderRadius: '999px',
                border: 'none',
                background: filter === f.key ? 'var(--sp-primary)' : 'var(--sp-surface)',
                color: filter === f.key ? 'white' : 'var(--sp-charcoal)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {f.label} <span style={{ opacity: 0.7 }}>({f.count})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Orders */}
      <div className="sp-card">
        {error && (
          <div style={{
            padding: '14px 24px',
            background: '#fef2f2',
            color: '#991b1b',
            borderBottom: '1px solid #fecaca',
            fontSize: '14px'
          }}>
            ⚠️ {error}
          </div>
        )}

        {filteredOrders.length === 0 ? (
          <div className="sp-empty">
            <div className="sp-empty-icon">📦</div>
            {orders.length === 0 ? (
              <>
                <h4>No orders yet</h4>
                <p>Place your first order to get started with easyassignments.</p>
                <Link to="/dashboard/new-order" className="sp-btn sp-btn-primary">
                  Place First Order →
                </Link>
              </>
            ) : (
              <>
                <h4>No {filter} orders</h4>
                <p>Try a different filter or place a new order.</p>
              </>
            )}
          </div>
        ) : (
          <>
            {/* ── DESKTOP TABLE (≥641px) ── */}
            <div className="mo-table-wrap">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ background: 'var(--sp-surface)' }}>
                    <th style={thStyle}>Order ID</th>
                    <th style={thStyle}>Subject</th>
                    <th style={thStyle}>Type</th>
                    <th style={thStyle}>Words</th>
                    <th style={thStyle}>Deadline</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => (
                    <tr
                      key={order.id}
                      className="sp-table-row-clickable"
                      onClick={() => navigate(`/dashboard/orders/${order.id}`)}
                      style={{ borderBottom: '1px solid var(--sp-surface)' }}
                    >
                      <td style={tdStyle}>
                        <span style={{
                          fontFamily: 'monospace',
                          color: 'var(--sp-amber)',
                          fontWeight: 700,
                          fontSize: '12px',
                          whiteSpace: 'nowrap'
                        }}>
                          {order.order_number?.replace('EA-', '')}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 700, color: 'var(--sp-primary)' }}>
                          {order.subject}
                        </div>
                        {order.title && order.title !== order.subject && (
                          <div style={{ fontSize: '12px', color: 'var(--sp-muted)', marginTop: '2px' }}>
                            {order.title}
                          </div>
                        )}
                      </td>
                      <td style={tdStyle}>{order.type}</td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: '13px' }}>
                          {order.word_count?.toLocaleString() || '—'}
                        </span>
                      </td>
                      <td style={tdStyle}>{formatDate(order.deadline)}</td>
                      <td style={tdStyle}>
                        <span className={`sp-status-badge ${order.status}`}>
                          ● {order.status}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button
                            className="sp-btn sp-btn-secondary"
                            style={{ fontSize: '13px', padding: '6px 14px' }}
                          >
                            View
                          </button>
                          {orderUnreads[order.id] > 0 && (
                            <span style={{
                              background: '#ef4444', color: 'white',
                              fontSize: 10, fontWeight: 800,
                              width: 20, height: 20,
                              borderRadius: '50%', display: 'grid', placeItems: 'center',
                              animation: 'pulse-badge 2s ease-in-out infinite'
                            }}>
                              {orderUnreads[order.id]}
                            </span>
                          )}
                          {canDelete(order) && (
                            <button
                              onClick={e => { e.stopPropagation(); setDeleteConfirm(order) }}
                              title="Delete order"
                              style={{
                                background: 'none', border: '1.5px solid #fca5a5',
                                borderRadius: 7, padding: '5px 8px', cursor: 'pointer',
                                color: '#ef4444', display: 'flex', alignItems: 'center',
                                transition: 'all 0.15s'
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2' }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── MOBILE CARDS (≤640px) ── */}
            <div className="mo-cards">
              {filteredOrders.map((order) => (
                <div
                  key={order.id}
                  className="mo-card"
                  onClick={() => navigate(`/dashboard/orders/${order.id}`)}
                >
                  {/* Card header row */}
                  <div className="mo-card-header">
                    <span className="mo-card-id">
                      #{order.order_number?.replace('EA-', '')}
                    </span>
                    <span className={`sp-status-badge ${order.status}`}>
                      ● {order.status}
                    </span>
                  </div>

                  {/* Subject */}
                  <div className="mo-card-subject">{order.subject}</div>
                  {order.title && order.title !== order.subject && (
                    <div className="mo-card-title">{order.title}</div>
                  )}

                  {/* Meta grid */}
                  <div className="mo-card-meta">
                    <div className="mo-card-meta-item">
                      <span className="mo-card-meta-label">Type</span>
                      <span className="mo-card-meta-value">{order.type || '—'}</span>
                    </div>
                    <div className="mo-card-meta-item">
                      <span className="mo-card-meta-label">Words</span>
                      <span className="mo-card-meta-value">{order.word_count?.toLocaleString() || '—'}</span>
                    </div>
                    <div className="mo-card-meta-item mo-card-meta-full">
                      <span className="mo-card-meta-label">Deadline</span>
                      <span className="mo-card-meta-value">{formatDate(order.deadline) || '—'}</span>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="mo-card-footer">
                    <button className="sp-btn sp-btn-secondary" style={{ fontSize: '13px', padding: '6px 16px' }}>
                      View Order
                    </button>
                    {orderUnreads[order.id] > 0 && (
                      <span className="mo-card-unread">
                        {orderUnreads[order.id]} new msg{orderUnreads[order.id] > 1 ? 's' : ''}
                      </span>
                    )}
                    {canDelete(order) && (
                      <button
                        onClick={e => { e.stopPropagation(); setDeleteConfirm(order) }}
                        style={{
                          marginLeft: 'auto', background: 'none',
                          border: '1.5px solid #fca5a5', borderRadius: 7,
                          padding: '5px 10px', cursor: 'pointer', color: '#ef4444', fontSize: 13
                        }}
                      >
                        🗑️ Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {filteredOrders.length > 0 && (
          <div style={{
            padding: '12px 24px',
            borderTop: '1px solid var(--sp-surface)',
            color: 'var(--sp-muted)',
            fontSize: '13px'
          }}>
            Showing {filteredOrders.length} of {orders.length} orders
          </div>
        )}
      </div>
      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
          backdropFilter: 'blur(4px)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }} onClick={() => !deleting && setDeleteConfirm(null)}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'white', borderRadius: 18, padding: '32px 28px',
              maxWidth: 400, width: '100%', textAlign: 'center',
              boxShadow: '0 24px 60px rgba(0,0,0,0.2)'
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 12 }}>🗑️</div>
            <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
              Delete Order?
            </h3>
            <p style={{ margin: '0 0 6px', fontSize: 14, color: '#64748b' }}>
              Order <strong style={{ fontFamily: 'monospace', color: '#0f172a' }}>
                #{deleteConfirm.order_number?.replace('EA-', '')}
              </strong> will be permanently deleted.
            </p>
            <p style={{ margin: '0 0 24px', fontSize: 13, color: '#94a3b8' }}>
              This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                style={{
                  flex: 1, padding: '11px', border: '1.5px solid #e2e8f0',
                  borderRadius: 10, background: 'white', fontWeight: 600,
                  fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', color: '#64748b'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => deleteOrder(deleteConfirm)}
                disabled={deleting}
                style={{
                  flex: 1, padding: '11px', border: 'none', borderRadius: 10,
                  background: deleting ? '#fca5a5' : '#ef4444',
                  color: 'white', fontWeight: 700, fontSize: 14,
                  cursor: deleting ? 'not-allowed' : 'pointer', fontFamily: 'inherit'
                }}
              >
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </StudentLayout>
  )
}

const thStyle = {
  padding: '12px 16px',
  textAlign: 'left',
  fontWeight: 600,
  fontSize: '12px',
  textTransform: 'uppercase',
  color: 'var(--sp-muted)',
  letterSpacing: '0.05em'
}

const tdStyle = {
  padding: '14px 16px'
}

export default MyOrders
