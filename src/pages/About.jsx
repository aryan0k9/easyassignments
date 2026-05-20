import { Link } from 'react-router-dom'
import { getAllExperts } from '../data/experts'
import ExpertCard from '../components/ExpertCard'

const topExperts = getAllExperts().filter(e => e.isTopRated).slice(0, 3)

function About() {
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <span className="eyebrow">About easyassignments</span>
          <h1 className="page-title">A trusted academic partner for serious students.</h1>
          <p className="page-sub">We're on a mission to make academic excellence accessible to every student without the stress.</p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="about-grid">
            <div>
              <h2 className="section-title-left">Our Story</h2>
              <p className="about-text">
                easyassignments started in 2026 with a simple belief: every student deserves
                expert academic support. What began as a small group of PhD scholars helping
                struggling students has grown into a trusted platform serving 50,000+ students
                across 30+ countries.
              </p>
              <p className="about-text">
                We've built our reputation on three things quality, integrity, and reliability.
                Every assignment we deliver is custom-written by a verified PhD expert, backed by
                a free plagiarism report, and protected by our money-back guarantee.
              </p>
              <p className="about-text">
                Today, we're proud to be one of the highest-rated academic help platforms in
                the world, with a 4.9/5 rating across Trustpilot, Sitejabber, and Google.
              </p>
            </div>
            <div className="about-stats">
              <div className="about-stat">
                <div className="stat-num">50K+</div>
                <div className="stat-label">Students helped</div>
              </div>
              <div className="about-stat">
                <div className="stat-num">2,000+</div>
                <div className="stat-label">PhD experts</div>
              </div>
              <div className="about-stat">
                <div className="stat-num">100+</div>
                <div className="stat-label">Subjects covered</div>
              </div>
              <div className="about-stat">
                <div className="stat-num">30+</div>
                <div className="stat-label">Countries served</div>
              </div>
              <div className="about-stat">
                <div className="stat-num">98.2%</div>
                <div className="stat-label">On-time delivery</div>
              </div>
              <div className="about-stat">
                <div className="stat-num">4.9/5</div>
                <div className="stat-label">Avg. student rating</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section section-alt">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">Our Values</span>
            <h2 className="section-title">What we stand for</h2>
          </div>

          <div className="features-grid">
            {[
              { icon: '🎯', title: 'Quality First', desc: 'Every paper meets the highest academic standards. No shortcuts. Ever.' },
              { icon: '🔒', title: 'Total Confidentiality', desc: 'Your identity, data, and work stay strictly private guaranteed.' },
              { icon: '⏱️', title: 'Reliability', desc: '98.2% on-time delivery. Your deadlines are sacred to us.' },
              { icon: '💯', title: 'Integrity', desc: 'Original work, transparent pricing, and honest communication.' }
            ].map((v, i) => (
              <div key={i} className="feature-card">
                <div className="feature-icon">{v.icon}</div>
                <h3>{v.title}</h3>
                <p>{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">Our Team</span>
            <h2 className="section-title">Meet the experts behind your grades</h2>
            <p className="section-sub">Hand-picked PhDs from leading universities. Top 1% of academic writers worldwide.</p>
          </div>

          <div className="experts-page-grid">
            {topExperts.map(expert => (
              <ExpertCard key={expert.id} expert={expert} />
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 32 }}>
            <Link to="/experts" className="btn btn-outline btn-lg">View All Experts →</Link>
          </div>
        </div>
      </section>

      <section className="big-cta">
        <div className="container big-cta-inner">
          <div>
            <h2>Ready to work with the best?</h2>
            <p>Join 50,000+ students who trust easyassignments for their academic success.</p>
          </div>
          <Link to="/order" className="btn btn-primary btn-lg">Get Started →</Link>
        </div>
      </section>
    </>
  )
}

export default About
