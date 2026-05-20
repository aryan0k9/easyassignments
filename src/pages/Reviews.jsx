import { Link } from 'react-router-dom'

function Reviews() {
  const reviews = [
    { initials: 'PS', name: 'Priya S.', meta: 'University of Sydney · Finance', rating: 5, date: 'Apr 24, 2026', text: 'Got my finance assignment back in 24 hours and it scored a HD. The expert was super responsive and made all my edits for free. Highly recommend!' },
    { initials: 'JM', name: 'James M.', meta: 'University of Toronto · Computer Science', rating: 5, date: 'Apr 22, 2026', text: 'I was stuck on a Java programming assignment with a 12-hour deadline. AssignPro delivered working, commented code in 8 hours. Saved my semester.' },
    { initials: 'AK', name: 'Aisha K.', meta: "King's College London · MBA", rating: 5, date: 'Apr 20, 2026', text: 'Honestly the best assignment service I have used. The dissertation chapter was deeply researched, properly cited, and zero plagiarism. Worth every dollar.' },
    { initials: 'RT', name: 'Rohan T.', meta: 'Monash University · Nursing', rating: 5, date: 'Apr 18, 2026', text: 'Tried 3 other services before this they all delivered garbage. AssignPro actually has real PhD writers. My nursing case study got top marks.' },
    { initials: 'EW', name: 'Emily W.', meta: 'University of Manchester · Law', rating: 5, date: 'Apr 16, 2026', text: 'Customer support is on another level. They responded to my WhatsApp at 2am and got me an expert immediately. Got an A in my law assignment.' },
    { initials: 'KP', name: 'Karan P.', meta: 'IIT Delhi · Engineering', rating: 5, date: 'Apr 14, 2026', text: 'Pricing is fair, quality is fantastic, and they actually deliver before the deadline. I have been a returning customer for 2 years now. Trust them fully.' },
    { initials: 'OB', name: 'Oliver B.', meta: 'University of Oxford · Philosophy', rating: 5, date: 'Apr 12, 2026', text: 'Outstanding research paper on Kantian ethics. The expert clearly had deep knowledge of the subject proper citations, original arguments, perfect formatting.' },
    { initials: 'CG', name: 'Chloe G.', meta: 'UCLA · Marketing', rating: 5, date: 'Apr 10, 2026', text: 'Needed a marketing case study for Nike my expert delivered industry-grade analysis with real frameworks. Got 92% on it. Could not be happier.' },
    { initials: 'DR', name: 'Daniel R.', meta: 'University of Melbourne · Data Science', rating: 5, date: 'Apr 8, 2026', text: 'Python data analysis project completed in 24 hours. Code was clean, well-documented, and the visualizations were beautiful. Highly recommend!' },
    { initials: 'SC', name: 'Sophie C.', meta: 'NYU · Psychology', rating: 4, date: 'Apr 6, 2026', text: 'Great research methodology section for my thesis. Required one revision but they delivered the update in just 4 hours. Solid service overall.' },
    { initials: 'MK', name: 'Marcus K.', meta: 'University of Edinburgh · Economics', rating: 5, date: 'Apr 4, 2026', text: 'Macroeconomics essay was excellent clear argumentation, strong evidence, well-cited. My professor wrote "best in class" feedback.' },
    { initials: 'LF', name: 'Léa F.', meta: 'Sorbonne University · Sociology', rating: 5, date: 'Apr 2, 2026', text: 'My sociology essay needed urgent help. The team matched me with an expert in 3 minutes and delivered in 6 hours. Quality was exceptional.' }
  ]

  const renderStars = (count) => '★'.repeat(count) + '☆'.repeat(5 - count)

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <span className="eyebrow">Student Reviews</span>
          <h1 className="page-title">Loved by 50,000+ students worldwide</h1>
          <p className="page-sub">Real reviews from real students who scored top grades with AssignPro.</p>

          <div className="experts-hero-stats">
            <div className="hero-stat-pill">
              <strong>4.9/5</strong>
              <span>Trustpilot</span>
            </div>
            <div className="hero-stat-pill">
              <strong>4.8/5</strong>
              <span>Sitejabber</span>
            </div>
            <div className="hero-stat-pill">
              <strong>4.9/5</strong>
              <span>Google</span>
            </div>
            <div className="hero-stat-pill">
              <strong>50,000+</strong>
              <span>Total reviews</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="reviews-grid">
            {reviews.map((r, i) => (
              <div key={i} className="review-card">
                <div className="review-stars">{renderStars(r.rating)}</div>
                <p className="review-text">"{r.text}"</p>
                <div className="review-author">
                  <div className="review-avatar">{r.initials}</div>
                  <div>
                    <div className="review-name">{r.name}</div>
                    <div className="review-meta">{r.meta}</div>
                    <div className="review-meta" style={{ fontSize: '11px', marginTop: '2px' }}>{r.date}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="big-cta">
        <div className="container big-cta-inner">
          <div>
            <h2>Join 50,000+ happy students</h2>
            <p>Get matched with the perfect expert for your assignment in 4 minutes.</p>
          </div>
          <Link to="/order" className="btn btn-primary btn-lg">Order Now →</Link>
        </div>
      </section>
    </>
  )
}

export default Reviews
