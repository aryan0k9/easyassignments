import { Link, useParams } from 'react-router-dom'
import QuoteForm from '../components/QuoteForm'
import { getSubjectData, getRelatedSubjects, slugify } from '../data/subjects'

function SubjectDetail() {
  const { slug } = useParams()
  const effectiveSlug = slug || 'java-programming'

  const subject = getSubjectData(effectiveSlug)
  const relatedSubjects = getRelatedSubjects(effectiveSlug)

  // Subject not found 404
  if (!subject) {
    return (
      <section className="page-hero" style={{ minHeight: '60vh' }}>
        <div className="container" style={{ textAlign: 'center', padding: '60px 0' }}>
          <span className="eyebrow">404 Not Found</span>
          <h1 className="page-title">Subject Not Found</h1>
          <p className="page-sub">We couldn't find that subject. Browse our subjects from the navbar or contact us.</p>
          <div style={{ marginTop: '32px', display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/" className="btn btn-primary">Back to Home</Link>
            <Link to="/contact" className="btn btn-outline">Contact Us</Link>
          </div>
        </div>
      </section>
    )
  }

  return (
    <>
      {/* HERO with breadcrumb */}
      <section className="subject-hero">
        <div className="container">
          <div className="breadcrumb">
            <Link to="/">Home</Link>
            <span className="breadcrumb-sep">/</span>
            <Link to="/services">Subjects</Link>
            <span className="breadcrumb-sep">/</span>
            <span className="breadcrumb-current">{subject.category}</span>
            <span className="breadcrumb-sep">/</span>
            <span className="breadcrumb-current">{subject.name}</span>
          </div>

          <div className="subject-hero-grid">
            <div className="subject-hero-left">
              <div className="subject-icon-large">{subject.icon}</div>
              <span className="eyebrow">{subject.category}</span>
              <h1 className="subject-title">{subject.name} Help</h1>
              <p className="subject-tagline">{subject.tagline}</p>
              <p className="subject-description">{subject.description}</p>

              {/* CTA #1 - Hero buttons */}
              <div className="subject-hero-actions">
                <Link to="/order" className="btn btn-primary btn-lg">Order Now →</Link>
                <a href="#topics" className="btn btn-outline btn-lg">View Topics</a>
              </div>

              <div className="subject-stats">
                {subject.stats.map((s, i) => (
                  <div key={i} className="subject-stat">
                    <div className="stat-num">{s.num}</div>
                    <div className="stat-label">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="subject-hero-right">
              <QuoteForm
                title={`Get ${subject.name} Help`}
                subtitle="Free quote in 4 minutes. No payment until you approve."
              />
            </div>
          </div>
        </div>
      </section>

      {/* OVERVIEW */}
      <section className="section">
        <div className="container">
          <div className="subject-overview">
            <div className="section-head section-head-left">
              <span className="eyebrow">Overview</span>
              <h2 className="section-title-left">About {subject.name} Assignment Help</h2>
            </div>
            {subject.overview.map((para, i) => (
              <p key={i} className="overview-text">{para}</p>
            ))}

            {/* CTA #2 - After overview */}
            <div className="inline-cta-box">
              <div className="inline-cta-text">
                <h3>Ready to get started with your {subject.name} assignment?</h3>
                <p>Get a free quote in 4 minutes. No payment until you approve the writer.</p>
              </div>
              <Link to="/order" className="btn btn-primary btn-lg">Order Now →</Link>
            </div>
          </div>
        </div>
      </section>

      {/* TOPICS COVERED */}
      <section className="section section-alt" id="topics">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">What We Cover</span>
            <h2 className="section-title">Topics in {subject.name}</h2>
            <p className="section-sub">From basics to advanced our experts handle every aspect of {subject.name}.</p>
          </div>

          <div className="topics-grid">
            {subject.topics.map((topic, i) => (
              <div key={i} className="topic-card">
                <h3>{topic.title}</h3>
                <ul>
                  {topic.items.map((item, j) => (
                    <li key={j}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY CHOOSE US */}
      <section className="section">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">Why AssignPro</span>
            <h2 className="section-title">Why students choose us for {subject.name}</h2>
          </div>

          <div className="features-grid">
            {subject.benefits.map((b, i) => (
              <div key={i} className="feature-card">
                <div className="feature-icon">{b.icon}</div>
                <h3>{b.title}</h3>
                <p>{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SAMPLE ASSIGNMENTS */}
      <section className="section section-alt">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">Recent Work</span>
            <h2 className="section-title">Sample {subject.name} Assignments</h2>
            <p className="section-sub">A glimpse of recent assignments completed by our experts.</p>
          </div>

          <div className="samples-grid">
            {subject.samples.map((s, i) => (
              <div key={i} className="sample-card">
                <div className="sample-grade">{s.grade}</div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
                <div className="sample-tags">
                  {s.tags.map((t, j) => <span key={j}>{t}</span>)}
                </div>
              </div>
            ))}
          </div>

          {/* CTA #3 - After samples */}
          <div className="cta-strip">
            <p><strong>Want quality work like this for your assignment?</strong> Get matched with an expert in 4 minutes.</p>
            <Link to="/order" className="btn btn-primary">Order Now →</Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">FAQ</span>
            <h2 className="section-title">{subject.name} Common questions</h2>
          </div>

          <div className="faq-list">
            {subject.faqs.map((f, i) => (
              <details key={i} className="faq-item" open={i === 0}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* RELATED SUBJECTS */}
      {relatedSubjects.length > 0 && (
        <section className="section section-alt">
          <div className="container">
            <div className="section-head">
              <span className="eyebrow">Related Subjects</span>
              <h2 className="section-title">You might also need help with</h2>
            </div>

            <div className="related-grid">
              {relatedSubjects.map((rs, i) => (
                <Link key={i} to={`/subject/${slugify(rs.name)}`} className="related-card">
                  <div className="related-icon">{rs.icon}</div>
                  <div className="related-info">
                    <h4>{rs.name}</h4>
                    <span>{rs.category}</span>
                  </div>
                  <span className="related-arrow">→</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* BIG CTA - Final */}
      <section className="big-cta">
        <div className="container big-cta-inner">
          <div>
            <h2>Need help with {subject.name}?</h2>
            <p>Get matched with an expert in 4 minutes. Free quote, no payment required upfront.</p>
          </div>
          <Link to="/order" className="btn btn-primary btn-lg">Order Now →</Link>
        </div>
      </section>
    </>
  )
}

export default SubjectDetail
