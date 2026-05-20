import { Link } from 'react-router-dom'

function Services() {
  const services = [
    { icon: '📝', title: 'Assignment Writing', desc: 'Custom written assignments delivered on time, every time. Tailored to your university guidelines and grading rubrics.', features: ['Custom-written from scratch', 'Subject-matter expert', 'Free Turnitin report', 'Unlimited revisions'] },
    { icon: '✍️', title: 'Essay Help', desc: 'Argumentative, expository, narrative, persuasive all essay types covered with proper structure and citations.', features: ['All essay types', 'Strong thesis & argumentation', 'Proper citations (APA, MLA, etc.)', 'Polished writing'] },
    { icon: '🎓', title: 'Dissertation & Thesis', desc: 'End-to-end dissertation help from proposal to defense. Methodology, literature review, data analysis we cover it all.', features: ['Proposal to final draft', 'Statistical analysis', 'Literature review', 'Defense preparation'] },
    { icon: '💻', title: 'Programming Help', desc: 'Java, Python, C++, SQL, web development, mobile apps. Working code with proper documentation and comments.', features: ['Java, Python, C++, JS, more', 'Working & tested code', 'Inline comments', 'Algorithm explanations'] },
    { icon: '📚', title: 'Coursework Help', desc: 'Complete coursework with consistent quality across all modules. Perfect for students juggling multiple deadlines.', features: ['Multiple modules covered', 'Consistent voice & quality', 'Module-specific expertise', 'Flexible scheduling'] },
    { icon: '🔍', title: 'Case Study Analysis', desc: 'Industry-grade case study analysis using real frameworks like SWOT, PESTLE, Porter\'s Five Forces.', features: ['Real-world frameworks', 'Industry data & insights', 'Structured analysis', 'Actionable recommendations'] },
    { icon: '📊', title: 'Research Paper', desc: 'Original research with proper methodology, data collection, analysis, and academic-grade citations.', features: ['Original research', 'Data analysis', 'Academic citations', 'Peer-review ready'] },
    { icon: '✅', title: 'Proofreading & Editing', desc: 'Polish your draft to a publication-ready manuscript. Grammar, structure, flow, and clarity improvements.', features: ['Grammar & spelling', 'Sentence structure', 'Flow & coherence', 'Style improvements'] },
    { icon: '📖', title: 'Homework Help', desc: 'Quick, accurate homework help across all subjects. Step-by-step solutions you can actually learn from.', features: ['All subjects covered', 'Step-by-step solutions', 'Quick turnaround', 'Available 24/7'] },
    { icon: '💼', title: 'Business Writing', desc: 'Business plans, reports, proposals, and SWOT analyses crafted to professional standards.', features: ['Business plans & reports', 'Professional tone', 'Industry research', 'Presentation-ready'] },
    { icon: '🧪', title: 'Lab Reports', desc: 'Detailed lab reports with proper methodology, data presentation, and scientific analysis.', features: ['Proper lab format', 'Data tables & charts', 'Scientific analysis', 'Conclusions & references'] },
    { icon: '🎯', title: 'Exam & Online Class Help', desc: 'Live exam help, online quiz support, and full online class management discreet and effective.', features: ['Live exam help', 'Quiz support', 'Online class management', '100% confidential'] }
  ]

  return (
    <>
      {/* Page Hero */}
      <section className="page-hero">
        <div className="container">
          <span className="eyebrow">Our Services</span>
          <h1 className="page-title">Every academic service, one trusted partner.</h1>
          <p className="page-sub">From quick homework help to full dissertation support our PhD experts handle it all.</p>
        </div>
      </section>

      {/* Services List */}
      <section className="section">
        <div className="container">
          <div className="services-detailed">
            {services.map((s, i) => (
              <div key={i} className="service-detail-card">
                <div className="service-detail-head">
                  <div className="service-icon">{s.icon}</div>
                  <h3>{s.title}</h3>
                </div>
                <p>{s.desc}</p>
                <ul className="service-features">
                  {s.features.map((f, j) => <li key={j}>✓ {f}</li>)}
                </ul>
                <Link to={`/order?service=${encodeURIComponent(s.title)}`} className="btn btn-outline">Order Now →</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="big-cta">
        <div className="container big-cta-inner">
          <div>
            <h2>Need help with something else?</h2>
            <p>Just contact us we cover 100+ subjects and almost every academic format.</p>
          </div>
          <Link to="/contact" className="btn btn-primary btn-lg">Contact Us →</Link>
        </div>
      </section>
    </>
  )
}

export default Services
