import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import StudentLayout from './StudentLayout'
import { getAllExperts } from '../../data/experts'
import { allSubjects } from '../../data/subjects'

const PAGE_SIZE = 12

function ExpertCard({ expert }) {
  return (
    <div className="expert-page-card">
      <div className="expert-card-top">
        <div className="expert-avatar-wrap">
          <img
            src={expert.avatarUrl}
            alt={`${expert.name} avatar`}
            className="expert-avatar-img"
            loading="lazy"
          />
          {expert.isOnline && <span className="online-badge" title="Online now"></span>}
        </div>
        <div className="expert-badges">
          {expert.isTopRated && <span className="badge badge-top">⭐ Top Rated</span>}
          {expert.isOnline && <span className="badge badge-online">🟢 Online</span>}
        </div>
      </div>

      <div className="expert-name-row">
        <h3>{expert.name}</h3>
        <img
          src={`https://flagcdn.com/w40/${expert.countryCode}.png`}
          srcSet={`https://flagcdn.com/w80/${expert.countryCode}.png 2x`}
          alt={`${expert.country} flag`}
          className="expert-flag"
          title={expert.country}
          loading="lazy"
        />
      </div>

      <p className="expert-credentials">{expert.degree}, {expert.primarySubject}</p>
      <p className="expert-university">{expert.university}</p>

      <div className="expert-rating-row">
        <div className="expert-rating">
          <span className="stars">★</span>
          <strong>{expert.rating}</strong>
          <span className="review-count">({expert.reviewCount} reviews)</span>
        </div>
        <div className="expert-projects-count">
          {expert.projects.toLocaleString()} projects
        </div>
      </div>

      <p className="expert-bio-text">{expert.bio}</p>

      <div className="expert-subject-tags">
        {expert.subjects.slice(0, 3).map((s, i) => (
          <span key={i}>{s.icon} {s.name}</span>
        ))}
      </div>

      <div className="expert-card-footer">
        <Link
          to={`/dashboard/new-order?expert=${encodeURIComponent(expert.name)}&expertAvatar=${encodeURIComponent(expert.avatarUrl)}&expertId=${expert.id}`}
          className="btn btn-primary btn-block"
        >
          Hire Now →
        </Link>
      </div>
    </div>
  )
}

export default function DashboardExperts() {
  const allExperts = getAllExperts()
  const [filter, setFilter] = useState('all')
  const [selectedSubject, setSelectedSubject] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const filtered = useMemo(() => {
    let result = allExperts

    if (filter === 'top-rated') result = result.filter(e => e.isTopRated)
    else if (filter === 'online') result = result.filter(e => e.isOnline)

    if (selectedSubject !== 'all')
      result = result.filter(e => e.subjects.some(s => s.name === selectedSubject))

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(e =>
        e.name.toLowerCase().includes(q) ||
        e.primarySubject.toLowerCase().includes(q) ||
        e.country.toLowerCase().includes(q)
      )
    }

    return result
  }, [allExperts, filter, selectedSubject, searchQuery])

  const visible = filtered.slice(0, visibleCount)
  const hasMore = visibleCount < filtered.length

  const onlineCount  = allExperts.filter(e => e.isOnline).length
  const topCount     = allExperts.filter(e => e.isTopRated).length

  function reset() {
    setFilter('all')
    setSelectedSubject('all')
    setSearchQuery('')
    setVisibleCount(PAGE_SIZE)
  }

  return (
    <StudentLayout title="Experts">
      {/* Stats strip */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        {[
          { label: 'Total Experts', value: `${allExperts.length.toLocaleString()}+` },
          { label: 'Online Now',    value: onlineCount, green: true },
          { label: 'Top Rated',     value: `${topCount}+` },
          { label: 'Avg Rating',    value: '4.9/5' },
        ].map(s => (
          <div key={s.label} style={{
            background: 'white', border: '1px solid #e5e7eb', borderRadius: 10,
            padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 2,
          }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: s.green ? '#16a34a' : '#0f172a' }}>{s.value}</span>
            <span style={{ fontSize: 12, color: '#6b7280' }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 16px', marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { key: 'top-rated', label: '⭐ Top Rated' },
            { key: 'all',       label: '👥 All Experts' },
            { key: 'online',    label: '🟢 Online Now' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => { setFilter(f.key); setVisibleCount(PAGE_SIZE) }}
              style={{
                padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                border: filter === f.key ? '2px solid #16a34a' : '1px solid #e5e7eb',
                background: filter === f.key ? '#f0fdf4' : 'white',
                color: filter === f.key ? '#16a34a' : '#374151',
              }}
            >{f.label}</button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 14 }}>🔍</span>
            <input
              type="text"
              placeholder="Search name, subject, country..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setVisibleCount(PAGE_SIZE) }}
              style={{ paddingLeft: 32, paddingRight: 12, paddingTop: 8, paddingBottom: 8, border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, outline: 'none', width: 220 }}
            />
          </div>
          <select
            value={selectedSubject}
            onChange={e => { setSelectedSubject(e.target.value); setVisibleCount(PAGE_SIZE) }}
            style={{ padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, outline: 'none' }}
          >
            <option value="all">All Subjects</option>
            {allSubjects.map((s, i) => (
              <option key={i} value={s.name}>{s.icon} {s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Results info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, fontSize: 13, color: '#6b7280' }}>
        <span>Showing <strong style={{ color: '#0f172a' }}>{visible.length}</strong> of <strong style={{ color: '#0f172a' }}>{filtered.length.toLocaleString()}</strong> experts</span>
        {(filter !== 'all' || selectedSubject !== 'all' || searchQuery) && (
          <button onClick={reset} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>Clear filters ✕</button>
        )}
      </div>

      {/* Grid */}
      {visible.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af' }}>
          <div style={{ fontSize: 40 }}>🔍</div>
          <p style={{ marginTop: 12, fontWeight: 600 }}>No experts found</p>
          <button onClick={reset} style={{ marginTop: 12, padding: '8px 20px', background: '#16a34a', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Reset Filters</button>
        </div>
      ) : (
        <>
          <div className="experts-page-grid">
            {visible.map(expert => <ExpertCard key={expert.id} expert={expert} />)}
          </div>

          {hasMore && (
            <div style={{ textAlign: 'center', marginTop: 32 }}>
              <button
                onClick={() => setVisibleCount(v => v + PAGE_SIZE)}
                style={{ padding: '12px 32px', border: '2px solid #e5e7eb', background: 'white', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
              >
                Load More ({filtered.length - visibleCount} remaining)
              </button>
            </div>
          )}
        </>
      )}
    </StudentLayout>
  )
}
