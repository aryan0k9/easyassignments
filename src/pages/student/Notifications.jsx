import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import StudentLayout from './StudentLayout'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

// Helper to format timestamp
const formatTime = (isoString) => {
  if (!isoString) return ''
  const date = new Date(isoString)
  return date.toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true
  })
}

function Notifications() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [notifs, setNotifs] = useState([])
  const [loading, setLoading] = useState(true)
  const autoMarkedRef = useRef(false) // ensures auto-mark only fires once per page visit

  useEffect(() => {
    if (!user?.id) return

    fetchNotifications()

    // Realtime subscription
    const channel = supabase.channel('notifs-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => {
        fetchNotifications()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user?.id])

  // Auto-mark all as read after 4 seconds of viewing
  useEffect(() => {
    if (loading) return                          // wait until notifications are loaded
    if (autoMarkedRef.current) return            // only run once per visit
    if (!notifs.some(n => !n.read)) return       // nothing unread, skip

    autoMarkedRef.current = true
    const timer = setTimeout(() => {
      handleMarkAll()
    }, 4000)

    return () => clearTimeout(timer)
  }, [loading, notifs]) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchNotifications() {
    setLoading(true)
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      
    setNotifs(data || [])
    setLoading(false)
  }

  const handleMarkAll = async () => {
    // Optimistic update
    setNotifs(notifs.map(n => ({ ...n, read: true })))
    
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false)
  }

  const iconFor = (type) => {
    if (type === 'order') return { icon: '📦', cls: 'order' }
    if (type === 'payment') return { icon: '💳', cls: 'payment' }
    if (type === 'message') return { icon: '💬', cls: 'message' }
    return { icon: '🔔', cls: 'order' }
  }

  const getLink = (n) => {
    if (n.link) return n.link
    if (n.type === 'payment') return '/dashboard/payments'
    if (n.type === 'message') return '/dashboard/messages'
    if (n.type === 'order') return '/dashboard/orders'
    return '/dashboard'
  }

  async function handleClick(n) {
    if (!n.read) {
      setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))
      await supabase.from('notifications').update({ read: true }).eq('id', n.id)
    }
    navigate(getLink(n))
  }

  return (
    <StudentLayout title="Notifications">
      <div className="sp-card">
        <div className="sp-card-header">
          <h3 className="sp-card-title">🔔 Notifications</h3>
          {notifs.some(n => !n.read) && (
            <button className="sp-card-link" onClick={handleMarkAll} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
              Mark all read
            </button>
          )}
        </div>

        {notifs.length === 0 ? (
          <div className="sp-empty">
            <div className="sp-empty-icon">🔔</div>
            <h4>No notifications yet</h4>
            <p>You'll get notified about order updates, payments, messages, and more.</p>
            <Link to="/dashboard/new-order" className="sp-btn sp-btn-primary">Place Your First Order →</Link>
          </div>
        ) : (
          <div>
            {notifs.map(n => {
              const ic = iconFor(n.type)
              return (
                <div
                  key={n.id}
                  className={`sp-notif-item ${!n.read ? 'unread' : ''}`}
                  onClick={() => handleClick(n)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className={`sp-notif-icon ${ic.cls}`}>{ic.icon}</div>
                  <div className="sp-notif-content">
                    <p className="sp-notif-title">{n.title}</p>
                    <p className="sp-notif-message">{n.message}</p>
                    <span className="sp-notif-time">{formatTime(n.created_at)}</span>
                  </div>
                  {!n.read && <div className="sp-notif-dot"></div>}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </StudentLayout>
  )
}

export default Notifications
