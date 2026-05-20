import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

// Helper to convert subject name to URL slug
const slugify = (text) =>
  text.toLowerCase()
    .replace(/[\/&]/g, '-')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

function Header() {
  const navigate = useNavigate()
  const { isAuthenticated, getUserName, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [subjectsOpen, setSubjectsOpen] = useState(false)
  const [mobileSubjectsOpen, setMobileSubjectsOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const closeMenu = () => {
    setMenuOpen(false)
    setSubjectsOpen(false)
    setMobileSubjectsOpen(false)
    setUserMenuOpen(false)
  }

  const handleLogout = async () => {
    await logout()
    closeMenu()
    navigate('/')
  }

  const subjectCategories = [
    {
      title: 'Academic & Writing',
      subjects: [
        'Essay Writing', 'Editing And Proofreading', 'Business Writing',
        'Resume Writing', 'Cover Letter', 'Presentation', 'Excel'
      ]
    },
    {
      title: 'Computer Science & IT',
      subjects: [
        'Computer Science', 'Computer Architecture', 'Computer Network Security',
        'Computer Graphics and Multimedia Applications', 'Data Structures',
        'Database Management System', 'Design and Analysis of Algorithms',
        'Information Technology', 'Networking', 'Operating System',
        'Software Engineering', 'Software Testing', 'Linux Environment',
        'IoT Internet Of Things'
      ]
    },
    {
      title: 'Programming Languages',
      subjects: [
        'Programming Languages', 'Java Programming', 'Python Programming',
        'C/C++ Programming', 'R Programming', 'Visual Basic/C#', 'PHP',
        'PERL', 'Haskell Programming', 'Scripting', 'ASP.NET',
        'MATHEMATICA WOLFRAM Programming', 'MATLAB'
      ]
    },
    {
      title: 'Data & AI',
      subjects: [
        'Data Science', 'Data Mining', 'Big Data', 'Machine Learning',
        'Artificial Intelligence', 'Automata or Computation', 'TABLEAU',
        'SAS', 'SAP', 'Statistics'
      ]
    },
    {
      title: 'Web & App Development',
      subjects: [
        'Web Development', 'Android Development', 'IOS Development'
      ]
    },
    {
      title: 'Engineering',
      subjects: [
        'Engineering', 'Aeronautical Engineering', 'Biomedical Engineering',
        'Chemical Engineering', 'Chemical And Biomolecular Engineering',
        'Civil Engineering', 'Civil Engineer Structures', 'Construction Management',
        'Electrical Engineering', 'Electronic Engineering',
        'Environmental Engineering', 'Geotechnical Engineering',
        'Mechanical Engineering', 'Transport Engineering'
      ]
    },
    {
      title: 'Sciences',
      subjects: [
        'Biology', 'Chemistry', 'Physics', 'Geothermal Physics',
        'Geo Studies', 'Geography', 'Medical', 'Mathematics'
      ]
    },
    {
      title: 'Business & Management',
      subjects: [
        'Accounting', 'Finance', 'Economics', 'Management',
        'Project Management', 'Taxation', 'Admission Services'
      ]
    },
    {
      title: 'Humanities & Law',
      subjects: [
        'Humanities', 'English', 'Law', 'Psychology', 'Sociology'
      ]
    }
  ]

  return (
    <header className="header">
      <div className="container header-inner">
        <Link to="/" className="logo" onClick={closeMenu}>
          <span className="logo-mark">E</span>
          <span className="logo-text">easyassignments</span>
        </Link>

        <nav className={`nav ${menuOpen ? 'open' : ''}`}>
          <NavLink to="/" end onClick={closeMenu}>Home</NavLink>
          <NavLink to="/services" onClick={closeMenu}>Services</NavLink>

          {/* SUBJECTS MEGA MENU */}
          <div
            className={`nav-dropdown ${subjectsOpen ? 'open' : ''}`}
            onMouseEnter={() => setSubjectsOpen(true)}
            onMouseLeave={() => setSubjectsOpen(false)}
          >
            <button
              className="nav-dropdown-trigger"
              onClick={() => {
                if (window.innerWidth <= 768) {
                  setMobileSubjectsOpen(!mobileSubjectsOpen)
                } else {
                  setSubjectsOpen(!subjectsOpen)
                }
              }}
              aria-expanded={subjectsOpen}
            >
              Subjects <span className="nav-arrow">▾</span>
            </button>

            {/* Desktop mega menu */}
            <div className="mega-menu">
              <div className="mega-menu-inner">
                <div className="mega-menu-head">
                  <h4>Browse 75+ Subjects</h4>
                  <p>PhD experts available across every academic discipline</p>
                </div>
                <div className="mega-menu-grid">
                  {subjectCategories.map((cat, i) => (
                    <div key={i} className="mega-menu-col">
                      <h5>{cat.title}</h5>
                      <ul>
                        {cat.subjects.map((subject, j) => (
                          <li key={j}>
                            <Link to={`/subject/${slugify(subject)}`} onClick={closeMenu}>
                              {subject}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                <div className="mega-menu-footer">
                  <p>Can't find your subject? <Link to="/contact" onClick={closeMenu}>Contact us</Link> we cover 100+ subjects.</p>
                  <Link to="/order" className="btn btn-primary" onClick={closeMenu}>Get Free Quote →</Link>
                </div>
              </div>
            </div>

            {/* Mobile inline accordion */}
            {mobileSubjectsOpen && (
              <div className="mobile-subjects">
                {subjectCategories.map((cat, i) => (
                  <div key={i} className="mobile-subjects-cat">
                    <h5>{cat.title}</h5>
                    <ul>
                      {cat.subjects.map((subject, j) => (
                        <li key={j}>
                          <Link to={`/subject/${slugify(subject)}`} onClick={closeMenu}>
                            {subject}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>

          <NavLink to="/about" onClick={closeMenu}>About</NavLink>
          <NavLink to="/experts" onClick={closeMenu}>Experts</NavLink>
          <NavLink to="/blog" onClick={closeMenu}>Blog</NavLink>
          <NavLink to="/contact" onClick={closeMenu}>Contact</NavLink>
        </nav>

        <div className="header-actions">
          {isAuthenticated ? (
            <>
              <Link to="/dashboard" className="btn-text" onClick={closeMenu}>
                👤 {getUserName()}
              </Link>
              <button onClick={handleLogout} className="btn-text" style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                Logout
              </button>
            </>
          ) : (
            <Link to="/login" className="btn-text" onClick={closeMenu}>Login</Link>
          )}
          <Link to="/order" className="btn btn-primary" onClick={closeMenu}>
            Start Now →
          </Link>
          <button
            className="menu-toggle"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            <span></span><span></span><span></span>
          </button>
        </div>
      </div>
    </header>
  )
}

export default Header
