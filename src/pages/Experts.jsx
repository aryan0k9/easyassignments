import { useState, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getAllExperts, refreshOnlineStatus } from '../data/experts'
import { allSubjects } from '../data/subjects'
import ExpertCard from '../components/ExpertCard'

const PAGE_SIZE = 12
const REFRESH_INTERVAL = 5 * 60 * 1000 // 5 minutes in milliseconds

function Experts() {
  const [filter, setFilter] = useState('all') // 'top-rated', 'all', 'online'
  const [selectedSubject, setSelectedSubject] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  // Experts data is in state so it can refresh
  const [allExperts, setAllExperts] = useState(() => getAllExperts())

  // Auto-refresh online status every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      const updatedExperts = refreshOnlineStatus()
      setAllExperts(updatedExperts)
    }, REFRESH_INTERVAL)

    return () => clearInterval(interval)
  }, [])

  // Apply all filters
  const filteredExperts = useMemo(() => {
    let result = allExperts

    // Filter by main button
    if (filter === 'top-rated') {
      result = result.filter(e => e.isTopRated)
    } else if (filter === 'online') {
      result = result.filter(e => e.isOnline)
    }

    // Filter by subject
    if (selectedSubject !== 'all') {
      result = result.filter(e =>
        e.subjects.some(s => s.name === selectedSubject)
      )
    }

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter(e =>
        e.name.toLowerCase().includes(q) ||
        e.primarySubject.toLowerCase().includes(q) ||
        e.country.toLowerCase().includes(q)
      )
    }

    return result
  }, [allExperts, filter, selectedSubject, searchQuery])

  // Reset visible count when filters change
  const handleFilterChange = (newFilter) => {
    setFilter(newFilter)
    setVisibleCount(PAGE_SIZE)
  }

  const handleSubjectChange = (e) => {
    setSelectedSubject(e.target.value)
    setVisibleCount(PAGE_SIZE)
  }

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value)
    setVisibleCount(PAGE_SIZE)
  }

  const visibleExperts = filteredExperts.slice(0, visibleCount)
  const hasMore = visibleCount < filteredExperts.length

  // Stats
  const totalExperts = allExperts.length
  const onlineCount = allExperts.filter(e => e.isOnline).length
  const topRatedCount = allExperts.filter(e => e.isTopRated).length

  return (
    <>
      {/* HERO */}
      <section className="page-hero">
        <div className="container">
          <span className="eyebrow">Our Experts</span>
          <h1 className="page-title">Meet our 2,000+ verified experts</h1>
          <p className="page-sub">
            Hand-picked PhD scholars from top universities across the US, UK, Europe and Australia.
            Browse, filter, and choose the expert that matches your subject.
          </p>

          <div className="experts-hero-stats">
            <div className="hero-stat-pill">
              <strong>{totalExperts.toLocaleString()}+</strong>
              <span>Total experts</span>
            </div>
            <div className="hero-stat-pill hero-stat-pill-live">
              <span className="live-dot"></span>
              <strong className="text-green">{onlineCount}</strong>
              <span>Online now</span>
            </div>
            <div className="hero-stat-pill">
              <strong>{topRatedCount}+</strong>
              <span>Top rated</span>
            </div>
            <div className="hero-stat-pill">
              <strong>4.9/5</strong>
              <span>Avg rating</span>
            </div>
          </div>
        </div>
      </section>

      {/* FILTERS */}
      <section className="experts-filters-section">
        <div className="container">
          <div className="experts-filters">
            {/* Filter buttons */}
            <div className="filter-buttons">
              <button
                className={`filter-btn ${filter === 'top-rated' ? 'active' : ''}`}
                onClick={() => handleFilterChange('top-rated')}
              >
                ⭐ Top Rated
              </button>
              <button
                className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
                onClick={() => handleFilterChange('all')}
              >
                👥 All Experts
              </button>
              <button
                className={`filter-btn ${filter === 'online' ? 'active' : ''}`}
                onClick={() => handleFilterChange('online')}
              >
                <span className="online-dot"></span> Online Now
              </button>
            </div>

            {/* Search and dropdown */}
            <div className="filter-controls">
              <div className="search-wrap">
                <span className="search-icon">🔍</span>
                <input
                  type="text"
                  placeholder="Search by name, country..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  className="search-input"
                />
              </div>

              <select
                value={selectedSubject}
                onChange={handleSubjectChange}
                className="subject-select"
              >
                <option value="all">All Subjects</option>
                {allSubjects.map((s, i) => (
                  <option key={i} value={s.name}>{s.icon} {s.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Results count */}
          <div className="results-info">
            <span>
              Showing <strong>{visibleExperts.length}</strong> of <strong>{filteredExperts.length.toLocaleString()}</strong> experts
              {selectedSubject !== 'all' && <> in <strong>{selectedSubject}</strong></>}
              {filter === 'top-rated' && <> (Top Rated)</>}
              {filter === 'online' && <> (Online Now)</>}
            </span>
            {(filter !== 'all' || selectedSubject !== 'all' || searchQuery) && (
              <button
                className="clear-filters"
                onClick={() => {
                  setFilter('all')
                  setSelectedSubject('all')
                  setSearchQuery('')
                  setVisibleCount(PAGE_SIZE)
                }}
              >
                Clear all filters ✕
              </button>
            )}
          </div>
        </div>
      </section>

      {/* EXPERTS GRID */}
      <section className="section">
        <div className="container">
          {visibleExperts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🔍</div>
              <h3>No experts found</h3>
              <p>Try adjusting your filters or search terms.</p>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setFilter('all')
                  setSelectedSubject('all')
                  setSearchQuery('')
                }}
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <>
              <div className="experts-page-grid">
                {visibleExperts.map((expert) => (
                  <ExpertCard key={expert.id} expert={expert} />
                ))}
              </div>

              {hasMore && (
                <div className="load-more-wrap">
                  <button
                    className="btn btn-outline btn-lg"
                    onClick={() => setVisibleCount(visibleCount + PAGE_SIZE)}
                  >
                    Load More Experts ({filteredExperts.length - visibleCount} remaining)
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="big-cta">
        <div className="container big-cta-inner">
          <div>
            <h2>Can't decide which expert?</h2>
            <p>Submit your assignment requirements and we'll auto-match you with the perfect expert.</p>
          </div>
          <Link to="/order" className="btn btn-primary btn-lg">Order Now →</Link>
        </div>
      </section>
    </>
  )
}

export default Experts
