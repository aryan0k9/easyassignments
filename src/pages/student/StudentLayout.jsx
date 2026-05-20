import { useState, useEffect, useRef } from 'react'
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { buildStudentData } from '../../data/student'
import { supabase } from '../../lib/supabase'
import CouponBanner from '../../components/CouponBanner'
import '../../styles/student-panel.css'


function StudentLayout({ title, children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, loading, isAuthenticated, logout } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [chatUnread, setChatUnread] = useState(0)
  const [notifUnread, setNotifUnread] = useState(0)
  const globalChannelRef = useRef(null)
  const pollIntervalRef = useRef(null)
  const locationRef = useRef(location.pathname)
  const prevUnreadRef = useRef(null) // null = first load, so no sound on initial fetch

  // Build student data from real user (empty for new users)
  const data = buildStudentData(user)

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/login')
    }
  }, [loading, isAuthenticated, navigate])

  // Keep locationRef in sync so the real-time callback always has the fresh path
  useEffect(() => {
    locationRef.current = location.pathname
  }, [location.pathname])

  // ===== GLOBAL NOTIFICATION LISTENER =====
  useEffect(() => {
    if (!user?.id) return

    // Fetch unread counts immediately
    fetchUnreadCount()
    fetchNotifUnreadCount()

    // Polling fallback every 3s ensures badge updates even if real-time WebSocket misses an event
    pollIntervalRef.current = setInterval(() => {
      fetchUnreadCount()
      fetchNotifUnreadCount()
    }, 3000)

    // Instantly refresh when user switches back to this tab
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchUnreadCount()
        fetchNotifUnreadCount()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    // Join the shared global channel and set this user's ID as their presence key
    const channel = supabase.channel('student-global-notif', {
      config: {
        presence: {
          key: user.id
        }
      }
    })
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        async (payload) => {
          const msg = payload.new
          // Only notify for admin messages in this user's sessions
          if (msg.sender_type === 'admin') {
            const { data: session } = await supabase
              .from('chat_sessions')
              .select('user_id')
              .eq('id', msg.session_id)
              .single()

            if (session?.user_id === user.id) {
              playNotificationSound()
              fetchUnreadCount()
            }
          }
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => {
          fetchNotifUnreadCount()
          playNotificationSound()
        }
      )
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ online: true })
        }
      })

    globalChannelRef.current = channel
    return () => {
      supabase.removeChannel(channel)
      globalChannelRef.current = null
      document.removeEventListener('visibilitychange', handleVisibility)
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }
  }, [user?.id])

  async function fetchUnreadCount() {
    if (!user?.id) return
    // Only count unread admin messages from sessions the student can actually
    // see in the UI chat_type='order'. Otherwise stale guest/user-type
    // sessions inflate the badge with messages the student has no way to
    // reach (and therefore no way to mark read).
    const { data: sessions } = await supabase
      .from('chat_sessions')
      .select('id')
      .eq('user_id', user.id)
      .eq('chat_type', 'order')

    let newCount = 0
    if (sessions && sessions.length > 0) {
      const sessionIds = sessions.map(s => s.id)
      const { count } = await supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('sender_type', 'admin')
        .eq('read', false)
        .in('session_id', sessionIds)
      newCount = count || 0
    }

    // Play sound when new messages arrive (skip on first load)
    if (prevUnreadRef.current !== null && newCount > prevUnreadRef.current) {
      playNotificationSound()
    }
    prevUnreadRef.current = newCount
    setChatUnread(newCount)
  }

  async function fetchNotifUnreadCount() {
    if (!user?.id) return
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false)
    setNotifUnread(count || 0)
  }

  function playNotificationSound() {
    try {
      const AudioCtx = window.AudioContext || /** @type {any} */ (window).webkitAudioContext
      const ctx = new AudioCtx()
      const now = ctx.currentTime

      // 4-second pleasant chime C major arpeggio with long resonant decay
      const notes = [
        { freq: 523.25, start: 0,    dur: 3.8 },  // C5
        { freq: 659.25, start: 0.18, dur: 3.6 },  // E5
        { freq: 783.99, start: 0.36, dur: 3.4 },  // G5
        { freq: 1046.5, start: 0.55, dur: 3.2 },  // C6
      ]
      notes.forEach(({ freq, start, dur }) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, now + start)
        gain.gain.setValueAtTime(0, now + start)
        gain.gain.linearRampToValueAtTime(0.15, now + start + 0.04)
        gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur)
        osc.start(now + start)
        osc.stop(now + start + dur + 0.05)
      })

      // Subtle high shimmer that fades over 4s
      const shimmer = ctx.createOscillator()
      const shimmerGain = ctx.createGain()
      shimmer.connect(shimmerGain)
      shimmerGain.connect(ctx.destination)
      shimmer.type = 'sine'
      shimmer.frequency.setValueAtTime(2093, now + 0.6)  // C7
      shimmerGain.gain.setValueAtTime(0, now + 0.6)
      shimmerGain.gain.linearRampToValueAtTime(0.04, now + 0.65)
      shimmerGain.gain.exponentialRampToValueAtTime(0.001, now + 4.0)
      shimmer.start(now + 0.6)
      shimmer.stop(now + 4.05)
    } catch {}
  }

  // Loading state while checking auth
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: '#F3F4F6'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid #E5E7EB',
            borderTopColor: '#16A34A',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }}></div>
          <p style={{ color: '#6b7280', fontFamily: 'Inter Tight, sans-serif' }}>Loading your dashboard...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // Don't render dashboard if not authenticated (redirect is happening)
  if (!isAuthenticated) return null

  // Count unread items
  const unreadNotifs = notifUnread || 0
  const unreadMsgs = chatUnread || 0

  const handleLogout = () => setShowLogoutModal(true)

  const confirmLogout = async () => {
    setLoggingOut(true)
    await logout()
  }

  // Sidebar navigation items
  const navSections = [
    {
      label: 'Main',
      items: [
        { to: '/dashboard', icon: '📊', label: 'Dashboard' },
        { to: '/dashboard/orders', icon: '📦', label: 'My Orders' }
      ]
    },
    {
      label: 'Communication',
      items: [
        { 
          to: '/dashboard/messages', 
          icon: '💬', 
          label: 'Messages', 
          badge: unreadMsgs || null
        },
        { to: '/dashboard/notifications', icon: '🔔', label: 'Notifications', badge: unreadNotifs || null }
      ]
    },
    {
      label: 'Finance',
      items: [
        { to: '/dashboard/wallet', icon: '💰', label: 'Wallet' },
        { to: '/dashboard/payments', icon: '💳', label: 'Payments' }
      ]
    },
    {
      label: 'Planner',
      items: [
        { to: '/dashboard/deadlines', icon: '📅', label: 'Deadlines' }
      ]
    },
    {
      label: 'Files',
      items: [
        { to: '/dashboard/files', icon: '📁', label: 'My Files' }
      ]
    },
    {
      label: 'Extras',
      items: [
        { to: '/dashboard/experts', icon: '🎓', label: 'Experts' },
        { to: '/dashboard/achievements', icon: '🏆', label: 'Achievements' },
        { to: '/dashboard/referrals', icon: '🎁', label: 'Referrals' }
      ]
    },
    {
      label: 'Account',
      items: [
        { to: '/dashboard/profile', icon: '👤', label: 'My Profile' }
      ]
    }
  ]

  return (
    <div className="student-panel">
      {/* SIDEBAR */}
      <aside className={`sp-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <Link to="/dashboard" className="sp-logo">
          <span className="sp-logo-mark">E</span>
          <span className="sp-logo-text">easyassignments</span>
        </Link>

        <div className="sp-user-card">
          <div className="sp-user-avatar">{data.profile?.avatar || 'U'}</div>
          <div className="sp-user-info">
            <p className="sp-user-name">{data.profile?.name || 'User'}</p>
            <p className="sp-user-email">{data.profile?.email}</p>
          </div>
        </div>

        <nav className="sp-nav">
          {navSections.map((section, i) => (
            <div key={i} className="sp-nav-section">
              <p className="sp-nav-label">{section.label}</p>
              {section.items.map((item) => (
                <NavLink
                  key={item.label}
                  to={item.to}
                  end={item.to === '/dashboard'}
                  className={({ isActive }) => `sp-nav-link ${isActive && item.to !== '#' ? 'active' : ''}`}
                  onClick={(e) => {
                    if (item.onClick) {
                      item.onClick(e)
                    } else {
                      setSidebarOpen(false)
                    }
                  }}
                >
                  <span style={{ fontSize: '16px' }}>{item.icon}</span>
                  <span>{item.label}</span>
                  {item.badge && <span className="sp-nav-badge">{item.badge}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <button className="sp-logout-btn" onClick={handleLogout}>
          🚪 Logout
        </button>
      </aside>

      {/* SIDEBAR OVERLAY */}
      <div 
        className={`sp-sidebar-overlay ${sidebarOpen ? 'open' : ''}`} 
        onClick={() => setSidebarOpen(false)}
      ></div>

      {/* MAIN AREA */}
      <main className="sp-main">
        <header className="sp-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button 
              className="sp-mobile-menu-btn" 
              onClick={() => setSidebarOpen(true)}
              aria-label="Open Menu"
            >
              ☰
            </button>
            <h1 className="sp-header-title">{title}</h1>
          </div>

          <div className="sp-header-search">
            <span className="sp-search-icon">🔍</span>
            <input
              type="text"
              className="sp-search-input"
              placeholder="Search orders, files, messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="sp-header-actions">
            <Link to="/dashboard/new-order" className="sp-place-order-btn">
              <span>+</span> <span className="sp-btn-label">Place New Order</span>
            </Link>
            <Link to="/dashboard/notifications" className="sp-bell-btn">
              🔔
              {(unreadNotifs > 0 || chatUnread > 0) && <span className="sp-bell-badge"></span>}
            </Link>
          </div>
        </header>

        <div className="sp-content">
          <CouponBanner />
          {children}
        </div>
      </main>

      {/* LOGOUT MODAL */}
      {showLogoutModal && (
        <div
          onClick={() => !loggingOut && setShowLogoutModal(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'fadeIn .18s ease'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 24, padding: '36px 32px 28px',
              width: '100%', maxWidth: 360, textAlign: 'center',
              boxShadow: '0 24px 60px rgba(0,0,0,0.22)',
              animation: 'slideUp .2s ease'
            }}
          >
            {/* Icon */}
            <div style={{
              width: 72, height: 72, borderRadius: '50%', margin: '0 auto 20px',
              background: 'linear-gradient(135deg,#fee2e2,#fecaca)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 34
            }}>🚪</div>

            <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 800, color: '#0f172a' }}>
              Log Out?
            </h2>
            <p style={{ margin: '0 0 28px', fontSize: 14, color: '#64748b', lineHeight: 1.6 }}>
              You'll be signed out of your account.<br />Any unsaved changes will be lost.
            </p>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setShowLogoutModal(false)}
                disabled={loggingOut}
                style={{
                  flex: 1, padding: '13px', borderRadius: 12, border: '1.5px solid #e2e8f0',
                  background: '#f8fafc', color: '#374151', fontWeight: 700, fontSize: 14,
                  cursor: 'pointer', transition: 'all .15s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}
              >
                Cancel
              </button>
              <button
                onClick={confirmLogout}
                disabled={loggingOut}
                style={{
                  flex: 1, padding: '13px', borderRadius: 12, border: 'none',
                  background: loggingOut ? '#fca5a5' : 'linear-gradient(135deg,#ef4444,#dc2626)',
                  color: '#fff', fontWeight: 700, fontSize: 14,
                  cursor: loggingOut ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: '0 4px 14px rgba(239,68,68,0.35)', transition: 'all .15s'
                }}
              >
                {loggingOut ? (
                  <>
                    <span style={{
                      width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)',
                      borderTopColor: '#fff', borderRadius: '50%',
                      display: 'inline-block', animation: 'spin 0.7s linear infinite'
                    }} />
                    Logging out…
                  </>
                ) : 'Yes, Log Out'}
              </button>
            </div>
          </div>
          <style>{`
            @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
            @keyframes slideUp { from { opacity:0; transform:translateY(24px) } to { opacity:1; transform:translateY(0) } }
            @keyframes spin    { to { transform:rotate(360deg) } }
          `}</style>
        </div>
      )}

      {/* MOBILE BOTTOM NAV */}
      <nav className="sp-bottom-nav">
        <NavLink to="/dashboard" end className={({ isActive }) => `sp-bottom-nav-item${isActive ? ' active' : ''}`}>
          <span className="sp-bottom-nav-icon">📊</span>
          <span className="sp-bottom-nav-label">Home</span>
        </NavLink>
        <NavLink to="/dashboard/orders" className={({ isActive }) => `sp-bottom-nav-item${isActive ? ' active' : ''}`}>
          <span className="sp-bottom-nav-icon">📦</span>
          <span className="sp-bottom-nav-label">Orders</span>
        </NavLink>
        <NavLink to="/dashboard/messages" className={({ isActive }) => `sp-bottom-nav-item${isActive ? ' active' : ''}`}>
          <span className="sp-bottom-nav-icon">💬</span>
          {unreadMsgs > 0 && <span className="sp-bottom-nav-badge">{unreadMsgs > 9 ? '9+' : unreadMsgs}</span>}
          <span className="sp-bottom-nav-label">Chat</span>
        </NavLink>
        <NavLink to="/dashboard/payments" className={({ isActive }) => `sp-bottom-nav-item${isActive ? ' active' : ''}`}>
          <span className="sp-bottom-nav-icon">💳</span>
          <span className="sp-bottom-nav-label">Pay</span>
        </NavLink>
        <button className="sp-bottom-nav-item" onClick={() => setSidebarOpen(true)}>
          <span className="sp-bottom-nav-icon">☰</span>
          <span className="sp-bottom-nav-label">Menu</span>
        </button>
      </nav>
    </div>
  )
}

export default StudentLayout
