import { Link } from 'react-router-dom'

export default function ExpertCard({ expert }) {
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
          to={`/order?expert=${encodeURIComponent(expert.name)}&expertAvatar=${encodeURIComponent(expert.avatarUrl)}`}
          className="btn btn-primary btn-block"
        >Hire Now →</Link>
      </div>
    </div>
  )
}
