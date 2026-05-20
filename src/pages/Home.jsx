import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import QuoteForm from '../components/QuoteForm'
import { getAllExperts, refreshOnlineStatus } from '../data/experts'
import ExpertCard from '../components/ExpertCard'

const REFRESH_INTERVAL = 5 * 60 * 1000 // 5 minutes

function AnimatedCounter({ end, duration = 2000 }) {
  const [count, setCount] = useState(1)

  useEffect(() => {
    let startTime = null
    let animationFrameId = null

    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp
      const progress = timestamp - startTime
      const percentage = Math.min(progress / duration, 1)

      const ease = percentage === 1 ? 1 : 1 - Math.pow(2, -10 * percentage)
      setCount(Math.floor(ease * (end - 1) + 1))

      if (percentage < 1) {
        animationFrameId = requestAnimationFrame(animate)
      }
    }

    animationFrameId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationFrameId)
  }, [end, duration])

  return <>{count.toLocaleString()}</>
}

function Home() {
  const [allExperts, setAllExperts] = useState(() => getAllExperts())
  const [ordersThisHour, setOrdersThisHour] = useState(() => {
    const now = new Date()
    const seed = now.getFullYear() * 10000 + now.getMonth() * 100 + now.getDate() + now.getHours()
    const random = Math.abs(Math.sin(seed) * 10000)
    return Math.floor((random - Math.floor(random)) * (60 - 5 + 1)) + 5
  })

  useEffect(() => {
    const expertInterval = setInterval(() => {
      const updatedExperts = refreshOnlineStatus()
      setAllExperts(updatedExperts)
    }, REFRESH_INTERVAL)

    const ordersInterval = setInterval(() => {
      const now = new Date()
      const seed = now.getFullYear() * 10000 + now.getMonth() * 100 + now.getDate() + now.getHours()
      const random = Math.abs(Math.sin(seed) * 10000)
      setOrdersThisHour(Math.floor((random - Math.floor(random)) * (60 - 5 + 1)) + 5)
    }, 60000) // check every minute

    return () => {
      clearInterval(expertInterval)
      clearInterval(ordersInterval)
    }
  }, [])

  const onlineCount = allExperts.filter(e => e.isOnline).length

  const featuredExperts = [...allExperts]
    .filter(e => e.isTopRated)
    .sort((a, b) => (b.rating * 100 + b.projects / 100) - (a.rating * 100 + a.projects / 100))
    .slice(0, 6)

  return (
    <>
      {/* HERO */}
      <section className="hero">
        <div className="container hero-inner">
          <div className="hero-left">
            <div className="hero-badge">
              <span className="dot"></span> <AnimatedCounter end={onlineCount} /> experts live now
            </div>
            <h1 className="hero-title">
              Top grades start with the <span className="accent">right help.</span>
            </h1>
            <p className="hero-sub">
              Premium assignment help from verified PhD experts. Plagiarism-free,
              on time, every time. Trusted by 50,000+ students worldwide.
            </p>

            <div className="hero-live-ticker">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
              </svg>
              <div>
                <span className="ticker-dot"></span>
                <strong>  &nbsp; {ordersThisHour} students</strong> placed orders in the last hour
              </div>
            </div>

            <div className="hero-stats">
              <div className="stat">
                <div className="stat-num">98.2%</div>
                <div className="stat-label">On-time delivery</div>
              </div>
              <div className="stat">
                <div className="stat-num">4.9/5</div>
                <div className="stat-label">Student rating</div>
              </div>
              <div className="stat">
                <div className="stat-num">50K+</div>
                <div className="stat-label">Assignments done</div>
              </div>
            </div>

            <div className="hero-trust">
              <span>★★★★★ Trustpilot 4.9</span>
              <span>★★★★★ Sitejabber 4.8</span>
              <span>★★★★★ Google 4.9</span>
            </div>
          </div>

          <div className="hero-right">
            <QuoteForm />
          </div>
        </div>
      </section>

      {/* TRUST BAR */}
      <section className="trust-bar">
        <div style={{ maxWidth: '100%', padding: 0 }}>
          <p className="trust-bar-label">Trusted by students from top universities worldwide</p>
          <div className="trust-logos-marquee">
            <div className="trust-logos-track">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="trust-logos-group">
                  <span>Purdue Global</span><span>DeVry University</span><span>UMGC</span>
                  <span>TESU</span><span>Berkeley</span><span>Albany State University</span>
                  <span>Mercer University</span><span>Keiser University</span><span>TCC</span>
                  <span>CT State Community College</span><span>High Desert Medical College</span><span>Laney College</span>
                  <span>Laurel Springs School</span><span>NSU Florida</span><span>Widener University</span>
                  <span>WGU</span><span>University of Cincinnati</span><span>SUNY Westchester Community College</span>
                  <span>Quincy College</span><span>Capella University</span><span>Utah Tech University</span>
                  <span>Grand Canyon University</span><span>Lamar University</span><span>East Texas A&M University</span>
                </div>
              ))}
            </div>
          </div>

          <p className="trust-bar-label" style={{ marginTop: '2rem' }}>10k+ A Grades Delivered On Learning Platforms</p>
          <div className="trust-logos-marquee">
            <div className="trust-logos-track">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="trust-logos-group">
                  <span>Pearson</span><span>WebAssign</span><span>CENGAGE</span>
                  <span>ALEKS</span><span>Bb</span><span>SL</span>
                  <span>Study.com</span><span>KNEWTON</span><span>SOPHIA</span>
                  <span>canvas</span><span>LONE STAR COLLEGE</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* COMPARISON TABLE */}
      <section className="section">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">Why easyassignments</span>
            <h2 className="section-title">The smarter choice for serious students</h2>
            <p className="section-sub">See how we stack up against freelancers and AI tools there's no comparison.</p>
          </div>

          <div className="comparison-table-wrap">
            <table className="comparison-table">
              <thead>
                <tr>
                  <th className="comp-feature-col">Feature</th>
                  <th className="comp-us"><span className="comp-us-label">✦ easyassignments</span></th>
                  <th>Freelancer Sites</th>
                  <th>AI Writers (ChatGPT)</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Expert Credentials', 'Verified PhD Subject Experts', 'Varies (Unverified)', 'Algorithmic Patterns'],
                  ['Plagiarism Policy', '100% Unique + Turnitin Report', 'Risk of Recycling', 'High AI-Detection Risk'],
                  ['Reliability', '24/7 Support & Deadlines', 'Hit or Miss', 'Instant but Unreliable'],
                  ['Academic Integrity', 'Human-written, AI-detection free', 'Unknown origin', 'Easily flagged by tools'],
                  ['Revisions', 'Free unlimited revisions', 'Extra charges apply', 'Regenerate only'],
                  ['Subject Expertise', '75+ subjects covered', 'Varies widely', 'Generalised knowledge only'],
                  ['Confidentiality', 'SSL + Anonymous ID', 'Public profiles risk', 'Data used for training'],
                ].map(([feature, us, freelancer, ai], i) => (
                  <tr key={i}>
                    <td className="comp-feature">{feature}</td>
                    <td className="comp-us comp-best"><span className="comp-check">✓</span> {us}</td>
                    <td className="comp-mid"><span className="comp-warn">~</span> {freelancer}</td>
                    <td className="comp-bad"><span className="comp-x">✗</span> {ai}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="comparison-cta">
            <p>Join <strong>50,000+ students</strong> who already chose the professional standard.</p>
            <Link to="/order" className="btn btn-primary">Get My Assignment Done →</Link>
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section className="section" style={{ marginTop: '-50px' }}>
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">Our Services</span>
            <h2 className="section-title">Help with every kind of assignment</h2>
            <p className="section-sub">Pick from 100+ subjects across academic levels high school to PhD.</p>
          </div>

          <div className="services-grid">
            {[
              { icon: '📝', title: 'Assignment Writing', desc: 'Custom written assignments delivered on time, every time.' },
              { icon: '✍️', title: 'Essay Help', desc: 'Argumentative, expository, narrative all essay types covered.' },
              { icon: '🎓', title: 'Dissertation & Thesis', desc: 'End-to-end dissertation help from proposal to defense.' },
              { icon: '💻', title: 'Programming Help', desc: 'Java, Python, C++, SQL, Web Dev code that runs.' },
              { icon: '📚', title: 'Coursework Help', desc: 'Complete coursework with consistent quality across modules.' },
              { icon: '🔍', title: 'Case Study', desc: 'Industry-grade case study analysis with real frameworks.' },
              { icon: '📊', title: 'Research Paper', desc: 'Original research with proper citations and methodology.' },
              { icon: '✅', title: 'Proofreading & Editing', desc: 'Polish your draft to a publication-ready manuscript.' }
            ].map((s, i) => (
              <Link key={i} to="/services" className="service-card">
                <div className="service-icon">{s.icon}</div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
                <span className="service-link">Learn more →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="section section-alt">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">How it Works</span>
            <h2 className="section-title">Three simple steps to top grades</h2>
            <p className="section-sub">From submission to delivery quick, transparent, hassle-free.</p>
          </div>

          <div className="steps-grid">
            <div className="step-card">
              <div className="step-num">01</div>
              <h3>Share Requirements</h3>
              <p>Fill the quote form with your subject, deadline, and instructions. Upload any reference files.</p>
            </div>
            <div className="step-arrow">→</div>
            <div className="step-card">
              <div className="step-num">02</div>
              <h3>Pay & Get Matched</h3>
              <p>Pay securely via card or bank transfer. We assign the best PhD expert in your subject within minutes.</p>
            </div>
            <div className="step-arrow">→</div>
            <div className="step-card">
              <div className="step-num">03</div>
              <h3>Receive & Score</h3>
              <p>Get your plagiarism-free assignment delivered on time. Free unlimited revisions until you're happy.</p>
            </div>
          </div>

          <div className="cta-strip">
            <p><strong>Ready to score top grades?</strong> Get your free quote in 4 minutes.</p>
            <Link to="/order" className="btn btn-primary">Start Now →</Link>
          </div>
        </div>
      </section>

      {/* WHY CHOOSE US */}
      <section className="section">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">Why easyassignments</span>
            <h2 className="section-title">Built for serious students</h2>
            <p className="section-sub">Every feature you need to ace your academics nothing you don't.</p>
          </div>

          <div className="features-grid">
            {[
              { icon: '🎯', title: 'PhD Experts Only', desc: '2,000+ verified PhD writers from top universities. No outsourcing, ever.' },
              { icon: '🛡️', title: '100% Plagiarism-Free', desc: 'Every assignment is written from scratch. Turnitin report included.' },
              { icon: '⏱️', title: 'On-Time Delivery', desc: '98.2% on-time rate. Need it in 3 hours? We can do that too.' },
              { icon: '🔒', title: 'Confidential & Secure', desc: 'SSL encrypted. Your identity stays anonymous. Always.' },
              { icon: '💬', title: '24/7 Live Support', desc: 'Real humans, not bots. Average response time: 4 minutes.' },
              { icon: '💰', title: 'Money-Back Guarantee', desc: 'Not satisfied? Full refund no questions asked.' },
              { icon: '🔄', title: 'Free Unlimited Revisions', desc: "We revise until you're 100% happy. No extra charges." },
              { icon: '🌍', title: 'Global Coverage', desc: 'Supporting students in US, UK, Australia, Canada, India & more.' }
            ].map((f, i) => (
              <div key={i} className="feature-card">
                <div className="feature-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TAILORED ACADEMIC SUCCESS */}
      <section className="section section-alt">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">School to Career</span>
            <h2 className="section-title">Tailored success at every academic level</h2>
            <p className="section-sub">From high-school essays to professional certifications our PhD experts adapt to your exact environment, tone, and requirements.</p>
          </div>

          <div className="success-pillars">
            <div className="success-pillar">
              <div className="pillar-icon">🏫</div>
              <h3>High School</h3>
              <p>Structured essays, lab reports, and research projects written at the right reading level with correct citations to impress any teacher.</p>
              <ul className="pillar-list">
                <li>✓ AP & IB level writing</li>
                <li>✓ MLA / APA formatting</li>
                <li>✓ Plagiarism-free guarantee</li>
              </ul>
            </div>
            <div className="success-pillar success-pillar-featured">
              <div className="pillar-badge">Most Popular</div>
              <div className="pillar-icon">🎓</div>
              <h3>College & University</h3>
              <p>Dissertations, coursework, and case studies crafted by subject specialists who understand your university's marking rubrics inside out.</p>
              <ul className="pillar-list">
                <li>✓ Bachelor's to PhD level</li>
                <li>✓ 75+ subjects covered</li>
                <li>✓ Turnitin report</li>
              </ul>
            </div>
            <div className="success-pillar">
              <div className="pillar-icon">💼</div>
              <h3>Professional & Certification</h3>
              <p>Industry reports, certification coursework, and corporate assignments written to professional standards that advance your career.</p>
              <ul className="pillar-list">
                <li>✓ Nursing, Law, MBA & more</li>
                <li>✓ Industry-specific tone</li>
                <li>✓ Career-saver quality</li>
              </ul>
            </div>
          </div>

          <div className="success-testimonials">
            {[
              { quote: 'Best service for US students. 100% human-written and passed Turnitin AI detection perfectly!', name: 'Verified US Student', role: 'College Junior · Economics', icon: '🎓' },
              { quote: 'I was overwhelmed with my nursing certification, but easyassignments paired me with a PhD expert who understood the medical industry requirements perfectly. It was a career-saver!', name: 'Sarah M.', role: 'Healthcare Professional · Nursing Certification', icon: '🏥' },
              { quote: 'Finals week hit hard, but the Economics thesis support I received was original, delivered 2 days early, and cleared Turnitin with ease. My GPA is safe!', name: 'Tyler K.', role: 'College Junior · University of Michigan', icon: '📊' },
            ].map((t, i) => (
              <div key={i} className="success-testimonial">
                <div className="success-quote-icon">{t.icon}</div>
                <p className="success-quote">"{t.quote}"</p>
                <div className="success-author">
                  <strong>{t.name}</strong>
                  <span>{t.role}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURED EXPERTS - Pulled from Experts page */}
      <section className="section section-alt">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">Meet Our Experts</span>
            <h2 className="section-title">Top-rated experts ready to help</h2>
            <p className="section-sub">Hand-picked PhD scholars from leading universities across the US, UK, Europe and Australia.</p>
          </div>

          <div className="experts-page-grid">
            {featuredExperts.map((expert) => (
              <ExpertCard key={expert.id} expert={expert} />
            ))}
          </div>

          <div className="experts-cta-strip">
            <p>Browse all <strong>{allExperts.length.toLocaleString()}+ experts</strong> across 75+ subjects.</p>
            <Link to="/experts" className="btn btn-primary">View All Experts →</Link>
          </div>
        </div>
      </section>

      {/* DO MY ASSIGNMENT – SEO COPY */}
      <section className="section">
        <div className="container">
          <div className="do-my-grid">
            <div className="do-my-left">
              <span className="eyebrow">Expert Assignment Help</span>
              <h2 className="section-title-left">Can someone do my assignment for me?</h2>
              <p className="do-my-body">The answer is <strong>yes</strong> and you deserve more than a generic content mill. easyassignments connects you with real, verified PhD experts who genuinely care about your results.</p>
              <p className="do-my-body">Whether you have a difficult topic, a mountain of coursework, or a deadline that's closing in fast, our experts can write your assignment from scratch original, deeply researched, and formatted exactly to your university's requirements.</p>
              <p className="do-my-body">Choosing to get expert help doesn't mean cheating it means accessing the same mentorship support that top-tier students have always had. Every solution comes with explanations so you can understand the subject matter and grow academically.</p>
              <div className="do-my-features">
                {[
                  { icon: '🔒', text: 'SSL-encrypted & 100% confidential' },
                  { icon: '⚡', text: 'Delivered from 3 hours onwards' },
                  { icon: '🔄', text: 'Free unlimited revisions included' },
                  { icon: '💬', text: 'Direct writer communication' },
                ].map((f, i) => (
                  <div key={i} className="do-my-feature-item">
                    <span className="do-my-feature-icon">{f.icon}</span>
                    <span>{f.text}</span>
                  </div>
                ))}
              </div>
              <Link to="/order" className="btn btn-primary" style={{ marginTop: '28px' }}>Hire My Expert Now →</Link>
            </div>
            <div className="do-my-right">
              <div className="do-my-stat-stack">
                <div className="do-my-stat-card">
                  <div className="do-my-stat-num">2,000+</div>
                  <div className="do-my-stat-label">Verified PhD Experts</div>
                  <div className="do-my-stat-sub">Across 75+ subjects & disciplines</div>
                </div>
                <div className="do-my-stat-card">
                  <div className="do-my-stat-num">98.2%</div>
                  <div className="do-my-stat-label">On-Time Delivery Rate</div>
                  <div className="do-my-stat-sub">Even for 3-hour urgent deadlines</div>
                </div>
                <div className="do-my-stat-card">
                  <div className="do-my-stat-num">4.9/5</div>
                  <div className="do-my-stat-label">Average Student Rating</div>
                  <div className="do-my-stat-sub">Based on 50,000+ verified reviews</div>
                </div>
                <div className="do-my-stat-card do-my-stat-card-green">
                  <div className="do-my-stat-num">$0</div>
                  <div className="do-my-stat-label">Upfront Payment Required</div>
                  <div className="do-my-stat-sub">Pay only after approving your expert</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* REVIEWS */}
      <section className="section">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">Student Reviews</span>
            <h2 className="section-title">Loved by 50,000+ students</h2>
            <div className="review-rating-strip">
              <span>★★★★★ <strong>Trustpilot 4.9</strong></span>
              <span>★★★★★ <strong>Sitejabber 4.8</strong></span>
              <span>★★★★★ <strong>Google 4.9</strong></span>
            </div>
          </div>

          <div className="reviews-grid">
            {[
              { initials: 'PS', name: 'Priya S.', meta: 'University of Sydney · Finance', text: 'Got my finance assignment back in 24 hours and it scored a HD. The expert was super responsive and made all my edits for free. Highly recommend!' },
              { initials: 'JM', name: 'James M.', meta: 'University of Toronto · CS', text: 'I was stuck on a Java programming assignment with a 12-hour deadline. easyassignments delivered working, commented code in 8 hours. Saved my semester.' },
              { initials: 'AK', name: 'Aisha K.', meta: "King's College London · MBA", text: 'Honestly the best assignment service I have used. The dissertation chapter was deeply researched, properly cited, and zero plagiarism. Worth every dollar.' },
              { initials: 'RT', name: 'Rohan T.', meta: 'Monash University · Nursing', text: 'Tried 3 other services before this they all delivered garbage. easyassignments actually has real PhD writers. My nursing case study got top marks.' },
              { initials: 'EW', name: 'Emily W.', meta: 'Manchester · Law', text: 'Customer support is on another level. They responded to my WhatsApp at 2am and got me an expert immediately. Got an A in my law assignment.' },
              { initials: 'KP', name: 'Karan P.', meta: 'IIT Delhi · Engineering', text: 'Pricing is fair, quality is fantastic, and they actually deliver before the deadline. I have been a returning customer for 2 years now. Trust them fully.' }
            ].map((r, i) => (
              <div key={i} className="review-card">
                <div className="review-stars">★★★★★</div>
                <p className="review-text">"{r.text}"</p>
                <div className="review-author">
                  <div className="review-avatar">{r.initials}</div>
                  <div>
                    <div className="review-name">{r.name}</div>
                    <div className="review-meta">{r.meta}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ACADEMIC CHALLENGES */}
      <section className="section section-alt">
        <div className="container">
          <div className="challenges-grid">
            <div className="challenges-left">
              <span className="eyebrow">Why Students Need Help</span>
              <h2 className="section-title-left">The academic reality no one talks about</h2>
              <p className="challenges-body">Today's students juggle lectures, part-time jobs, personal commitments, and social lives all while maintaining grades that define their career trajectory. The pressure is real, and it's relentless.</p>
              <p className="challenges-body">International students face additional hurdles: writing in a second language, adapting to unfamiliar academic conventions, and decoding marking rubrics that differ vastly from their home countries.</p>
              <p className="challenges-body">Professional assignment help isn't a shortcut it's a <strong>model answer</strong> that demonstrates proper academic structure, critical analysis, and evidence-based argumentation. It's how students learn to write better.</p>
              <Link to="/order" className="btn btn-outline" style={{ marginTop: '20px' }}>Get Assignment Help →</Link>
            </div>
            <div className="challenges-right">
              <div className="challenge-cards">
                {[
                  { icon: '⏰', title: 'Time Pressure', desc: 'Clashing deadlines across multiple modules with no breathing room to do each one justice.' },
                  { icon: '📖', title: 'Subject Complexity', desc: "Highly technical content that demands deep expertise most students don't yet have." },
                  { icon: '🌏', title: 'International Barriers', desc: 'Second-language writing, unfamiliar referencing styles, and different academic norms.' },
                  { icon: '💼', title: 'Work-Life Balance', desc: 'Balancing part-time jobs, internships, and personal life alongside heavy coursework.' },
                  { icon: '📊', title: 'Research & Structure', desc: 'Conducting thorough literature reviews and building logical, evidence-based arguments.' },
                  { icon: '✍️', title: 'Writing Standards', desc: 'Meeting university-level referencing, formatting, and academic writing style requirements.' },
                ].map((c, i) => (
                  <div key={i} className="challenge-card">
                    <div className="challenge-icon">{c.icon}</div>
                    <div>
                      <h4>{c.title}</h4>
                      <p>{c.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FROM DRAFT TO DEADLINE */}
      <section className="section">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">Full Assignment Support</span>
            <h2 className="section-title">From draft to deadline we've got every stage</h2>
            <p className="section-sub">Whether you're staring at a blank page or need a final polish before submission, our experts step in exactly where you need them.</p>
          </div>

          <div className="stages-grid">
            {[
              { step: '01', icon: '💡', title: 'Topic & Research', desc: 'We help you choose strong topics, identify credible sources, and build a research foundation that impresses even the toughest markers.', tag: 'Research Phase' },
              { step: '02', icon: '📋', title: 'Planning & Outline', desc: 'Our experts create detailed outlines aligned to your rubric so the argument flows logically before a single paragraph is written.', tag: 'Structure Phase' },
              { step: '03', icon: '✍️', title: 'Writing & Drafting', desc: 'PhD-level writing from scratch, tailored to your subject, academic level, and university formatting requirements.', tag: 'Writing Phase' },
              { step: '04', icon: '🔍', title: 'Editing & Proofreading', desc: 'Every submission is reviewed for grammar, structure, argument quality, and citation accuracy before it reaches you.', tag: 'Polish Phase' },
              { step: '05', icon: '📊', title: 'Plagiarism Check', desc: 'We run every paper through Turnitin before delivery. Your free plagiarism report comes attached no AI detection flags.', tag: 'Quality Phase' },
              { step: '06', icon: '🚀', title: 'On-Time Delivery', desc: "Delivered to your inbox before your deadline. Need revisions? Free unlimited edits until you're completely satisfied.", tag: 'Delivery Phase' },
            ].map((s, i) => (
              <div key={i} className="stage-card">
                <div className="stage-top">
                  <span className="stage-step">{s.step}</span>
                  <span className="stage-tag">{s.tag}</span>
                </div>
                <div className="stage-icon">{s.icon}</div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>

          <div className="draft-cta-banner">
            <div className="draft-cta-left">
              <span className="draft-cta-urgent">⚡ Deadline Closing In?</span>
              <h3>Our urgent assignment team delivers in as little as 3 hours.</h3>
              <p>Just tell us what you need our subject specialists will get to work immediately, delivering high-quality, plagiarism-free content even on the tightest schedule.</p>
            </div>
            <div className="draft-cta-right">
              <Link to="/order" className="btn btn-primary btn-lg">Start Urgent Order →</Link>
              <Link to="/contact" className="btn btn-outline btn-lg">Talk to an Expert →</Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section section-alt" id="faq">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">FAQ</span>
            <h2 className="section-title">Frequently asked questions</h2>
            <p className="section-sub">Everything you need to know before placing your first order.</p>
          </div>

          <div className="faq-list">
            {[
              {
                q: 'Is using easyassignments safe and legal?',
                a: 'Absolutely. easyassignments is a legitimate academic support service. We provide reference papers, tutoring, and editing assistance fully legal in every country we operate in. Your identity stays 100% confidential, our platform is SSL-encrypted, and your data is never shared with anyone.'
              },
              {
                q: 'How does the ordering process work?',
                a: 'It takes 3 simple steps: (1) Fill the quote form with your subject, deadline, and instructions, (2) We match you with the best PhD expert in your field within 4 minutes you can review their profile and approve, (3) Pay securely and receive your assignment by your deadline. Free unlimited revisions are included.'
              },
              {
                q: 'Will my assignment be 100% original and plagiarism-free?',
                a: 'Yes every single assignment is written from scratch by our expert. We use Turnitin and other plagiarism detection tools to verify originality, and we provide a free plagiarism report with every order. Our work is also AI-detection-free, ensuring it passes all originality checks.'
              },
              {
                q: 'Can I choose my own expert?',
                a: 'Yes! Visit our Experts page to browse 2,000+ verified PhD scholars from the US, UK, Europe, and Australia. You can filter by subject, see their ratings, project counts, and bios, then choose the perfect match. Or let us auto-match you for the fastest service.'
              },
              {
                q: 'How fast can you deliver?',
                a: 'We offer flexible deadlines from 3 hours to 30+ days. Standard assignments are typically delivered within 24-72 hours. For urgent orders, we can deliver short tasks in as little as 3 hours. 98.2% of our orders arrive before deadline guaranteed.'
              },
              {
                q: 'What subjects do you cover?',
                a: 'We cover 75+ subjects across all academic disciplines including Programming (Java, Python, C++), Engineering, Business, Law, Nursing, Sciences, Humanities, and more. From high school to PhD level. If your subject isn\'t listed, just contact us we likely have an expert for it.'
              },
              {
                q: 'What if I\'m not satisfied with the work?',
                a: 'We offer two protections: (1) Free unlimited revisions until you\'re 100% happy with the work, and (2) A money-back guarantee if we still can\'t meet your requirements. No risk, no hassle, no questions asked.'
              },
              {
                q: 'How much does it cost?',
                a: 'Pricing depends on academic level, deadline, complexity, and length. Use our free quote form to get an exact price in under 4 minutes no payment required upfront. We offer transparent pricing with no hidden fees, and volume discounts for larger orders.'
              },
              {
                q: 'How do I make payment?',
                a: 'We accept all major credit cards (Visa, Mastercard, American Express) and bank transfer. All transactions are processed through SSL-encrypted, PCI-compliant gateways. Importantly, you only pay after approving the assigned expert no upfront payment required.'
              },
              {
                q: 'Will my professor know I used easyassignments?',
                a: 'No. We follow strict confidentiality protocols your identity is protected from our writers (who only know you by an anonymous ID), and we never share your data. The work is original, plagiarism-free, and tailored to your specific requirements, making it indistinguishable from your own writing.'
              }
            ].map((f, i) => (
              <details key={i} className="faq-item" open={i === 0}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>

          <div className="faq-cta">
            <p>Still have questions?</p>
            <Link to="/contact" className="btn btn-outline">Contact Our Team →</Link>
          </div>
        </div>
      </section>

      {/* BIG CTA */}
      <section className="big-cta">
        <div className="container big-cta-inner">
          <div>
            <h2>Stop stressing. Start scoring.</h2>
            <p>Get a free quote in 4 minutes. No payment until you approve the writer.</p>
          </div>
          <Link to="/order" className="btn btn-primary btn-lg">Get Free Quote →</Link>
        </div>
      </section>
    </>
  )
}

export default Home
