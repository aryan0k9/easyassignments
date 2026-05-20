import { Link, useParams } from 'react-router-dom'
import QuoteForm from '../components/QuoteForm'

const COUNTRY_DATA = {
  'au': {
    name: 'Australia',
    flag: '🇦🇺',
    code: 'au',
    currency: 'AUD',
    cities: ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide', 'Canberra', 'Gold Coast', 'Newcastle'],
    universities: ['University of Sydney', 'University of Melbourne', 'ANU', 'UNSW', 'Monash University', 'University of Queensland', 'University of Western Australia', 'Macquarie University'],
    description: 'Australian students trust AssignPro for assignment help. Our experts understand the Australian grading system (HD, D, Cr, P), follow Harvard and AGLC citation styles, and deliver work that aligns with your university\'s expectations.',
    highlights: ['Aussie experts available 24/7 (AEST/AEDT)', 'Harvard & AGLC citation specialists', 'Familiar with all Group of Eight universities', 'Aligns with Australian academic standards']
  },
  'uk': {
    name: 'United Kingdom',
    flag: '🇬🇧',
    code: 'gb',
    currency: 'GBP',
    cities: ['London', 'Manchester', 'Birmingham', 'Edinburgh', 'Glasgow', 'Liverpool', 'Leeds', 'Bristol', 'Cardiff', 'Belfast'],
    universities: ['University of Oxford', 'University of Cambridge', 'Imperial College London', 'UCL', "King's College London", 'LSE', 'University of Edinburgh', 'University of Manchester', 'University of Bristol', 'Warwick University'],
    description: 'UK students rely on AssignPro for premium assignment help. Our British-trained experts understand UK academic conventions, Russell Group university standards, and deliver work in Harvard, OSCOLA, and APA styles.',
    highlights: ['UK-based PhD experts', 'Harvard, OSCOLA, APA citations', 'Familiar with all Russell Group universities', 'Understanding of UK grading (1st, 2:1, 2:2)']
  },
  'us': {
    name: 'United States',
    flag: '🇺🇸',
    code: 'us',
    currency: 'USD',
    cities: ['New York', 'Los Angeles', 'Chicago', 'Boston', 'San Francisco', 'Washington DC', 'Seattle', 'Austin', 'Philadelphia', 'Atlanta'],
    universities: ['Harvard University', 'Stanford University', 'MIT', 'Princeton University', 'Yale University', 'Columbia University', 'UC Berkeley', 'University of Chicago', 'NYU', 'UCLA'],
    description: 'American students choose AssignPro for top-quality assignment help. Our US-based experts understand the American grading system (GPA, A-F), are fluent in APA, MLA, and Chicago styles, and align with Ivy League and major university expectations.',
    highlights: ['US PhDs from top universities', 'APA, MLA, Chicago specialists', 'GPA & credit hour aware', '24/7 support across all US time zones']
  },
  'ae': {
    name: 'United Arab Emirates',
    flag: '🇦🇪',
    code: 'ae',
    currency: 'AED',
    cities: ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Al Ain'],
    universities: ['American University in Dubai', 'University of Wollongong in Dubai', 'Heriot-Watt University Dubai', 'Khalifa University', 'UAE University', 'American University of Sharjah', 'Zayed University', 'NYU Abu Dhabi'],
    description: 'UAE students get expert assignment help from AssignPro. We work with students at American, British, and local UAE universities supporting English-medium courses across business, engineering, IT, and more.',
    highlights: ['Multi-curriculum experts (US, UK, AU)', 'Fluent in English academic standards', 'Familiar with all major UAE universities', 'Available across Gulf time zones']
  },
  'sg': {
    name: 'Singapore',
    flag: '🇸🇬',
    code: 'sg',
    currency: 'SGD',
    cities: ['Singapore', 'Jurong', 'Tampines', 'Woodlands', 'Bedok', 'Hougang', 'Sengkang'],
    universities: ['National University of Singapore (NUS)', 'Nanyang Technological University (NTU)', 'Singapore Management University (SMU)', 'SUTD', 'SIT', 'Singapore University of Social Sciences'],
    description: 'Singaporean students excel with AssignPro\'s assignment help. Our experts understand the rigorous Singapore education system, support all major SG universities, and deliver work that matches the high academic standards expected.',
    highlights: ['Experts for NUS, NTU, SMU students', 'Singapore curriculum aware', 'High-quality, rigorous standards', 'Fast turnaround across SG time zone']
  },
  'ca': {
    name: 'Canada',
    flag: '🇨🇦',
    code: 'ca',
    currency: 'CAD',
    cities: ['Toronto', 'Vancouver', 'Montreal', 'Calgary', 'Ottawa', 'Edmonton', 'Quebec City', 'Winnipeg', 'Halifax'],
    universities: ['University of Toronto', 'McGill University', 'University of British Columbia', 'University of Alberta', 'McMaster University', 'University of Waterloo', "Queen's University", 'Western University'],
    description: 'Canadian students trust AssignPro for assignment help. Our experts work with students across all U15 universities, support English and French courses, and follow Canadian academic conventions and citation styles.',
    highlights: ['U15 university specialists', 'English & French support', 'APA, MLA, Chicago expertise', '24/7 support across all Canadian time zones']
  },
  'my': {
    name: 'Malaysia',
    flag: '🇲🇾',
    code: 'my',
    currency: 'MYR',
    cities: ['Kuala Lumpur', 'Penang', 'Johor Bahru', 'Ipoh', 'Shah Alam', 'Petaling Jaya', 'Kuching', 'Kota Kinabalu'],
    universities: ['University of Malaya', 'Universiti Kebangsaan Malaysia (UKM)', 'Universiti Sains Malaysia (USM)', 'Universiti Putra Malaysia (UPM)', 'Universiti Teknologi Malaysia (UTM)', 'Monash University Malaysia', 'Taylor\'s University', 'Sunway University'],
    description: 'Malaysian students get expert academic support from AssignPro. We work with students across public and private universities, support both English and Bahasa Malaysia courses, and meet Malaysian academic standards.',
    highlights: ['Public & private university experts', 'Multi-language support', 'Familiar with Malaysian curriculum', 'Affordable rates in MYR']
  }
}

function CountryPage() {
  const { slug } = useParams()
  const country = COUNTRY_DATA[slug]

  if (!country) {
    return (
      <section className="page-hero" style={{ minHeight: '60vh' }}>
        <div className="container" style={{ textAlign: 'center', padding: '60px 0' }}>
          <span className="eyebrow">404 Not Found</span>
          <h1 className="page-title">Country Page Not Found</h1>
          <Link to="/" className="btn btn-primary" style={{ marginTop: '24px' }}>← Back to Home</Link>
        </div>
      </section>
    )
  }

  return (
    <>
      <section className="subject-hero">
        <div className="container">
          <div className="breadcrumb">
            <Link to="/">Home</Link>
            <span className="breadcrumb-sep">/</span>
            <span className="breadcrumb-current">Countries</span>
            <span className="breadcrumb-sep">/</span>
            <span className="breadcrumb-current">{country.name}</span>
          </div>

          <div className="subject-hero-grid">
            <div className="subject-hero-left">
              <div className="country-flag-large">
                <img
                  src={`https://flagcdn.com/w320/${country.code}.png`}
                  srcSet={`https://flagcdn.com/w640/${country.code}.png 2x`}
                  alt={`${country.name} flag`}
                />
              </div>
              <span className="eyebrow">Assignment Help in {country.name}</span>
              <h1 className="subject-title">Top Assignment Help for {country.name} Students</h1>
              <p className="subject-tagline">Trusted by thousands of students across {country.name}</p>
              <p className="subject-description">{country.description}</p>

              <div className="subject-hero-actions">
                <Link to="/order" className="btn btn-primary btn-lg">Order Now →</Link>
                <Link to="/experts" className="btn btn-outline btn-lg">View Experts</Link>
              </div>

              <div className="subject-stats">
                <div className="subject-stat">
                  <div className="stat-num">10K+</div>
                  <div className="stat-label">{country.name} students helped</div>
                </div>
                <div className="subject-stat">
                  <div className="stat-num">4.9/5</div>
                  <div className="stat-label">Local rating</div>
                </div>
                <div className="subject-stat">
                  <div className="stat-num">24/7</div>
                  <div className="stat-label">{country.name} support</div>
                </div>
                <div className="subject-stat">
                  <div className="stat-num">98%</div>
                  <div className="stat-label">On-time delivery</div>
                </div>
              </div>
            </div>

            <div className="subject-hero-right">
              <QuoteForm
                title={`${country.name} Assignment Help`}
                subtitle={`Free quote in 4 minutes. Pricing in ${country.currency}.`}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Cities */}
      <section className="section">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">Cities We Serve</span>
            <h2 className="section-title">Available across {country.name}</h2>
            <p className="section-sub">We provide assignment help to students in major cities and towns throughout {country.name}.</p>
          </div>

          <div className="subjects-grid">
            {country.cities.map((city, i) => (
              <div key={i} className="subject-tile">{city}</div>
            ))}
          </div>
        </div>
      </section>

      {/* Universities */}
      <section className="section section-alt">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">Universities We Serve</span>
            <h2 className="section-title">Helping students at top {country.name} universities</h2>
            <p className="section-sub">Our experts understand the curriculum and grading standards of {country.name}'s leading universities.</p>
          </div>

          <div className="topics-grid">
            {country.universities.map((uni, i) => (
              <div key={i} className="topic-card">
                <h3 style={{ fontSize: '15px', borderBottom: 'none', padding: 0, margin: 0 }}>🎓 {uni}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why students in this country choose us */}
      <section className="section">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">Why Students Choose Us</span>
            <h2 className="section-title">Made for {country.name} students</h2>
          </div>

          <div className="features-grid">
            {country.highlights.map((h, i) => (
              <div key={i} className="feature-card">
                <div className="feature-icon">✓</div>
                <h3>{h}</h3>
              </div>
            ))}
            <div className="feature-card">
              <div className="feature-icon">🌍</div>
              <h3>Local & global expertise</h3>
              <p>Get matched with experts who understand {country.name}'s academic context.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">💳</div>
              <h3>Flexible payment</h3>
              <p>Pay in {country.currency} or USD via secure card and bank transfer.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⏰</div>
              <h3>{country.name} time zone</h3>
              <p>Real-time support during {country.name} business hours and beyond.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🎯</div>
              <h3>Top grades guaranteed</h3>
              <p>98.2% of {country.name} students score top marks with our help.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="big-cta">
        <div className="container big-cta-inner">
          <div>
            <h2>Ready to ace your {country.name} assignment?</h2>
            <p>Get a free quote in 4 minutes. No payment until you approve the writer.</p>
          </div>
          <Link to="/order" className="btn btn-primary btn-lg">Order Now →</Link>
        </div>
      </section>
    </>
  )
}

export default CountryPage
