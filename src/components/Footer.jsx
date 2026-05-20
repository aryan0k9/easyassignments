import { Link } from 'react-router-dom'
import { PaymentCardIcons } from './PaymentIcons'

function Footer() {
  // Using flagcdn.com - free, fast, works on all browsers/systems including Windows
  const countries = [
    { name: 'Australia', slug: 'au', code: 'au' },
    { name: 'United Kingdom', slug: 'uk', code: 'gb' },
    { name: 'United States', slug: 'us', code: 'us' },
    { name: 'UAE', slug: 'ae', code: 'ae' },
    { name: 'Singapore', slug: 'sg', code: 'sg' },
    { name: 'Canada', slug: 'ca', code: 'ca' },
    { name: 'Malaysia', slug: 'my', code: 'my' }
  ]

  return (
    <footer className="footer">
      <div className="container">
        {/* Main grid */}
        <div className="footer-grid">
          <div className="footer-col footer-brand">
            <Link to="/" className="logo logo-light">
              <span className="logo-mark">E</span>
              <span className="logo-text">easyassignments</span>
            </Link>
            <p>
              Premium assignment help trusted by 50,000+ students across 30+ countries.
              Score top grades without the stress.
            </p>
            <div className="footer-contact">
              <p>📞 +91 12345 67890</p>
              <p>✉️ hello@easyassignments.com</p>
              <p>💬 WhatsApp: +91 12345 67890</p>
            </div>
          </div>

          <div className="footer-col">
            <h4>Services</h4>
            <ul>
              <li><Link to="/services">Assignment Help</Link></li>
              <li><Link to="/services">Essay Writing</Link></li>
              <li><Link to="/services">Dissertation Help</Link></li>
              <li><Link to="/services">Programming Help</Link></li>
              <li><Link to="/services">Coursework</Link></li>
              <li><Link to="/services">Case Study</Link></li>
              <li><Link to="/services">Proofreading</Link></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Subjects</h4>
            <ul>
              <li><Link to="/subject/management">Management</Link></li>
              <li><Link to="/subject/finance">Finance</Link></li>
              <li><Link to="/subject/law">Law</Link></li>
              <li><Link to="/subject/medical">Nursing</Link></li>
              <li><Link to="/subject/engineering">Engineering</Link></li>
              <li><Link to="/subject/programming-languages">Programming</Link></li>
              <li><Link to="/services">Marketing</Link></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Company</h4>
            <ul>
              <li><Link to="/about">About Us</Link></li>
              <li><Link to="/experts">Our Experts</Link></li>
              <li><Link to="/services">Our Services</Link></li>
              <li><Link to="/reviews">Reviews</Link></li>
              <li><Link to="/blog">Blog</Link></li>
              <li><Link to="/page/become-an-affiliate">Become an Affiliate</Link></li>
              <li><Link to="/contact">Contact Us</Link></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Resources</h4>
            <ul>
              <li><Link to="/blog">Blog</Link></li>
              <li><Link to="/tools/plagiarism-checker">Free Plagiarism Checker</Link></li>
              <li><Link to="/tools/word-counter">Word Counter</Link></li>
              <li><Link to="/page/citation-generator">Citation Generator</Link></li>
              <li><Link to="/page/sample-papers">Sample Papers</Link></li>
              <li><Link to="/page/honor-code">Honor Code</Link></li>
              <li><Link to="/page/privacy-policy">Privacy Policy</Link></li>
              <li><Link to="/page/terms-conditions">Terms & Conditions</Link></li>
            </ul>
          </div>
        </div>

        {/* Countries section */}
        <div className="footer-countries">
          <h4 className="footer-countries-title">Trusted by students worldwide we serve students across these countries</h4>
          <div className="footer-countries-grid">
            {countries.map((c) => (
              <Link key={c.slug} to={`/country/${c.slug}`} className="footer-country-link">
                <img
                  src={`https://flagcdn.com/w40/${c.code}.png`}
                  srcSet={`https://flagcdn.com/w80/${c.code}.png 2x`}
                  alt={`${c.name} flag`}
                  className="footer-country-flag"
                  loading="lazy"
                />
                <span>{c.name}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Trust Badges */}
        <div className="footer-trust-badges">
          <div className="money-back-badge">
            <span className="badge-icon">🛡️</span>
            <span><strong>100% Money-Back</strong> Guarantee</span>
          </div>
          <PaymentCardIcons width={44} height={28} gap={8} />
        </div>

        {/* Bottom */}
        <div className="footer-bottom">
          <p>© 2026 easyassignments. All rights reserved.</p>
          <p className="footer-disclaimer">
            <strong>Disclaimer:</strong> easyassignments provides reference papers for academic
            assistance. Documents are intended as model answers to improve research and
            writing skills, not for direct submission.
          </p>
        </div>
      </div>
    </footer>
  )
}

export default Footer
