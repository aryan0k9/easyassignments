import { useState, useEffect } from 'react'
import StudentLayout from './StudentLayout'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

function Achievements() {
  const { user } = useAuth()
  const [loading, setLoading]           = useState(true)
  const [achievements, setAchievements] = useState([])

  useEffect(() => {
    if (!user?.id) return
    loadAchievements()
  }, [user?.id])

  async function loadAchievements() {
    setLoading(true)

    // Fetch orders (must filter by site_id = 1 for easyassignments)
    const { data: orders } = await supabase
      .from('orders')
      .select('id, created_at, deadline, price, status')
      .eq('user_id', user.id)
      .eq('site_id', 1)

    // Fetch reviews/ratings (gracefully handle if table doesn't exist)
    const { data: reviews } = await supabase
      .from('ratings')
      .select('id')
      .eq('user_id', user.id)

    const orderList      = orders  || []
    const reviewList     = reviews || []

    const orderCount     = orderList.length
    const totalSpent     = orderList.reduce((s, o) => s + (parseFloat(o.price) || 0), 0)
    const reviewCount    = reviewList.length

    // Early Bird: any order placed 7+ days before its deadline
    const earlyBirdOrder = orderList.find(o => {
      if (!o.deadline || !o.created_at) return false
      const created  = new Date(o.created_at)
      const deadline = new Date(o.deadline)
      const diffDays = (deadline - created) / (1000 * 60 * 60 * 24)
      return diffDays >= 7
    })

    const computed = [
      {
        id: 1,
        icon: '🎯',
        title: 'First Order',
        description: 'Place your first order',
        earned: orderCount >= 1,
        progress: null,
      },
      {
        id: 2,
        icon: '🏆',
        title: 'Top Student',
        description: 'Score 90%+ on 3 assignments',
        earned: false, // requires grading system
        progress: null,
      },
      {
        id: 3,
        icon: '💎',
        title: 'Loyal Customer',
        description: 'Complete 5+ orders',
        earned: orderCount >= 5,
        progress: orderCount < 5 ? `${orderCount}/5` : null,
      },
      {
        id: 4,
        icon: '⚡',
        title: 'Early Bird',
        description: 'Order 7+ days before deadline',
        earned: !!earlyBirdOrder,
        progress: null,
      },
      {
        id: 5,
        icon: '💰',
        title: 'Big Spender',
        description: 'Spend $500+ total',
        earned: totalSpent >= 500,
        progress: totalSpent < 500 ? `$${Math.round(totalSpent)}/$500` : null,
      },
      {
        id: 6,
        icon: '⭐',
        title: 'Reviewer',
        description: 'Write 3+ reviews',
        earned: reviewCount >= 3,
        progress: reviewCount < 3 ? `${reviewCount}/3` : null,
      },
    ]

    setAchievements(computed)
    setLoading(false)
  }

  const earned     = achievements.filter(a => a.earned).length
  const total      = achievements.length
  const percentage = total > 0 ? Math.round((earned / total) * 100) : 0

  return (
    <StudentLayout title="Achievements">
      <div className="sp-card">
        <div className="sp-card-header">
          <h3 className="sp-card-title">🏆 Your Achievements</h3>
          <span style={{ fontSize: '14px', color: 'var(--sp-muted)' }}>
            <strong style={{ color: earned > 0 ? 'var(--sp-green)' : 'var(--sp-muted)' }}>
              {earned}/{total}
            </strong> unlocked ({percentage}%)
          </span>
        </div>

        {/* Progress bar */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--sp-surface)' }}>
          <div style={{
            width: '100%',
            height: '12px',
            background: 'var(--sp-surface)',
            borderRadius: '999px',
            overflow: 'hidden',
            marginBottom: '12px'
          }}>
            <div style={{
              width: `${percentage}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #16A34A 0%, #22c55e 100%)',
              borderRadius: '999px',
              transition: 'width 0.5s ease'
            }} />
          </div>
          <p style={{ textAlign: 'center', fontSize: '14px', color: 'var(--sp-muted)', margin: 0 }}>
            {loading
              ? '⏳ Loading your achievements...'
              : earned === 0
                ? '🎯 Place your first order to start unlocking achievements!'
                : earned === total
                  ? '🎉 Amazing! You unlocked all achievements!'
                  : `Keep going! Complete more to unlock all achievements 🚀`}
          </p>
        </div>

        {/* Achievement grid */}
        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--sp-muted)' }}>
            ⏳ Loading...
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '16px',
            padding: '24px'
          }}>
            {achievements.map((ach) => (
              <div key={ach.id} style={{
                border: ach.earned
                  ? '2px solid var(--sp-green)'
                  : '1px solid var(--sp-border)',
                background: ach.earned
                  ? 'linear-gradient(135deg, rgba(22,163,74,0.05) 0%, rgba(22,163,74,0.1) 100%)'
                  : 'white',
                borderRadius: '14px',
                padding: '24px',
                position: 'relative',
                opacity: ach.earned ? 1 : 0.6,
                transition: 'all 0.2s ease'
              }}>
                {ach.earned && (
                  <span style={{
                    position: 'absolute', top: '12px', right: '12px',
                    background: 'var(--sp-green)', color: 'white',
                    fontSize: '10px', fontWeight: 700,
                    padding: '3px 10px', borderRadius: '999px',
                    letterSpacing: '0.05em'
                  }}>
                    EARNED
                  </span>
                )}

                <div style={{
                  fontSize: '40px', marginBottom: '12px', textAlign: 'center',
                  filter: ach.earned ? 'none' : 'grayscale(100%)'
                }}>
                  {ach.icon}
                </div>

                <h4 style={{
                  fontFamily: 'var(--sp-font-display)', fontSize: '18px',
                  fontWeight: 700, color: 'var(--sp-primary)',
                  margin: '0 0 6px', textAlign: 'center'
                }}>
                  {ach.title}
                </h4>

                <p style={{
                  fontSize: '13px', color: 'var(--sp-muted)',
                  margin: '0 0 14px', textAlign: 'center', lineHeight: 1.4
                }}>
                  {ach.description}
                </p>

                <div style={{ textAlign: 'center' }}>
                  {ach.earned ? (
                    <span style={{
                      fontSize: '12px', color: 'var(--sp-green)',
                      fontWeight: 700, letterSpacing: '0.05em'
                    }}>
                      ✓ UNLOCKED
                    </span>
                  ) : ach.progress ? (
                    <span style={{
                      fontSize: '12px', background: 'var(--sp-surface)',
                      color: 'var(--sp-muted)', padding: '4px 10px',
                      borderRadius: '999px', fontWeight: 600
                    }}>
                      📊 {ach.progress}
                    </span>
                  ) : (
                    <span style={{ fontSize: '12px', color: 'var(--sp-muted)', fontWeight: 600 }}>
                      🔒 LOCKED
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </StudentLayout>
  )
}

export default Achievements
