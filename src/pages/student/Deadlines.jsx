import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import StudentLayout from './StudentLayout'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

function Deadlines() {
  const { user } = useAuth()
  const [upcoming, setUpcoming] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadDeadlines() {
      if (!user?.id) return
      setLoading(true)
      
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', user.id)
        .not('status', 'in', '("completed","cancelled","refunded")')
        .not('deadline', 'is', 'null')
      
      if (!error && data) {
        const sorted = data.sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
        setUpcoming(sorted)
      }
      setLoading(false)
    }
    
    loadDeadlines()
  }, [user?.id])

  const formatDay = (dateStr) => new Date(dateStr).getDate()
  const formatMonth = (dateStr) => new Date(dateStr).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
  const formatFullDate = (dateStr) => new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
  })

  const daysUntil = (dateStr) => {
    const diff = Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24))
    if (diff < 0) return { text: 'Overdue', color: '#EF4444', bg: '#FEF2F2', icon: '⚠️' }
    if (diff === 0) return { text: 'Due Today', color: '#EF4444', bg: '#FEF2F2', icon: '🚨' }
    if (diff === 1) return { text: 'Due Tomorrow', color: '#F59E0B', bg: '#FFFBEB', icon: '⏳' }
    if (diff <= 3) return { text: `In ${diff} days`, color: '#F59E0B', bg: '#FFFBEB', icon: '⏰' }
    return { text: `In ${diff} days`, color: '#10B981', bg: '#ECFDF5', icon: '📅' }
  }

  return (
    <StudentLayout title="Deadlines">
      <style>{`
        .deadline-card {
          display: flex;
          align-items: center;
          gap: 24px;
          padding: 24px;
          background: white;
          border-radius: 16px;
          border: 1px solid #E5E7EB;
          margin-bottom: 16px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }
        .deadline-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px -8px rgba(0, 0, 0, 0.1);
          border-color: #10B981;
        }
        .deadline-card::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 5px;
          background: var(--card-accent, #10B981);
          border-radius: 5px 0 0 5px;
        }
        .date-block {
          width: 85px;
          height: 85px;
          border-radius: 16px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.05);
        }
        .date-day {
          font-family: var(--sp-font-display);
          font-size: 36px;
          font-weight: 800;
          line-height: 1;
        }
        .date-month {
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.1em;
          margin-top: 6px;
        }
        .deadline-info {
          flex: 1;
          min-width: 0;
        }
        .deadline-title {
          font-family: var(--sp-font-display);
          font-size: 20px;
          font-weight: 700;
          color: #111827;
          margin: 6px 0 8px;
        }
        .deadline-meta {
          font-size: 14px;
          color: #6B7280;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .deadline-action {
          text-align: right;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 12px;
        }
        .countdown-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          border-radius: 999px;
          font-weight: 700;
          font-size: 14px;
        }
        .view-btn {
          padding: 10px 24px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          transition: all 0.2s;
        }
        .view-btn:hover {
          transform: scale(1.05);
        }
      `}</style>

      <div className="sp-card" style={{ background: 'transparent', border: 'none', boxShadow: 'none', padding: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--sp-font-display)', fontSize: '28px', color: '#111827', margin: 0 }}>Upcoming Deadlines</h2>
            <p style={{ color: '#6B7280', margin: '4px 0 0 0', fontSize: '15px' }}>Keep track of your assignment due dates.</p>
          </div>
          {upcoming.length > 0 && (
            <div style={{ background: 'white', padding: '8px 16px', borderRadius: '999px', border: '1px solid #E5E7EB', fontWeight: 600, color: '#374151', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
              🎯 {upcoming.length} Active {upcoming.length === 1 ? 'Deadline' : 'Deadlines'}
            </div>
          )}
        </div>

        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#6B7280' }}>
            <div style={{ fontSize: '32px', animation: 'spin 1s linear infinite', marginBottom: '16px' }}>⏳</div>
            <p>Loading your deadlines...</p>
            <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
          </div>
        ) : upcoming.length === 0 ? (
          <div style={{ 
            background: 'white', borderRadius: '24px', padding: '60px 20px', 
            textAlign: 'center', border: '1px dashed #D1D5DB',
            display: 'flex', flexDirection: 'column', alignItems: 'center'
          }}>
            <div style={{ fontSize: '64px', marginBottom: '20px' }}>🎉</div>
            <h3 style={{ fontFamily: 'var(--sp-font-display)', fontSize: '24px', color: '#111827', margin: '0 0 12px' }}>All caught up!</h3>
            <p style={{ color: '#6B7280', fontSize: '16px', maxWidth: '400px', margin: '0 0 24px', lineHeight: 1.6 }}>
              You have no upcoming deadlines. Place a new order to start tracking your assignment due dates here.
            </p>
            <Link to="/dashboard/new-order" className="sp-btn sp-btn-primary" style={{ padding: '12px 28px', fontSize: '16px', borderRadius: '12px' }}>
              Place First Order →
            </Link>
          </div>
        ) : (
          <div>
            {upcoming.map((order) => {
              const days = daysUntil(order.deadline)
              return (
                <div key={order.id} className="deadline-card" style={{ '--card-accent': days.color }}>
                  
                  {/* Date block */}
                  <div className="date-block" style={{ background: days.bg, color: days.color }}>
                    <div className="date-day">{formatDay(order.deadline)}</div>
                    <div className="date-month">{formatMonth(order.deadline)}</div>
                  </div>

                  {/* Info */}
                  <div className="deadline-info">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ 
                        background: '#F3F4F6', color: '#4B5563', padding: '4px 8px', 
                        borderRadius: '6px', fontSize: '12px', fontWeight: 700, letterSpacing: '0.05em' 
                      }}>
                        {order.order_number?.replace('EA-', '') || order.id}
                      </span>
                      <span className={`sp-status-badge ${order.status}`} style={{ margin: 0, fontSize: '11px' }}>
                        {order.status}
                      </span>
                    </div>
                    
                    <div className="deadline-title">
                      {order.subject || 'Untitled Assignment'}
                    </div>
                    
                    <div className="deadline-meta">
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        🗓️ {formatFullDate(order.deadline)}
                      </span>
                    </div>
                  </div>

                  {/* Action & Countdown */}
                  <div className="deadline-action">
                    <div className="countdown-badge" style={{ background: days.bg, color: days.color, border: `1px solid ${days.color}33` }}>
                      {days.icon} {days.text}
                    </div>
                    <Link 
                      to={`/dashboard/messages?tab=order&orderId=${order.id}`} 
                      className="sp-btn sp-btn-secondary view-btn"
                    >
                      View Details →
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </StudentLayout>
  )
}

export default Deadlines
