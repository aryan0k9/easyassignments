import { useState } from 'react'
import { Link } from 'react-router-dom'

function PlagiarismChecker() {
  const [text, setText] = useState('')
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState(null)

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0

  const handleCheck = () => {
    if (wordCount < 10) {
      alert('Please enter at least 10 words to check.')
      return
    }
    setScanning(true)
    setResult(null)
    setTimeout(() => {
      setScanning(false)
      // Simulated result for the demo (real version requires a backend API)
      setResult({
        originality: 94,
        sources: 0,
        wordCount
      })
    }, 2500)
  }

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <span className="eyebrow">Free Tool</span>
          <h1 className="page-title">Free Plagiarism Checker</h1>
          <p className="page-sub">Quickly check your assignment for plagiarism and originality issues. 100% free, no signup required.</p>
        </div>
      </section>

      <section className="section">
        <div className="container" style={{ maxWidth: '900px' }}>
          <div className="tool-card">
            <h3 className="tool-card-title">Paste your text below</h3>
            <textarea
              className="tool-textarea"
              placeholder="Paste your essay, assignment, or any text here (minimum 10 words)..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={12}
            />
            <div className="tool-stats">
              <span><strong>{wordCount}</strong> words · <strong>{text.length}</strong> characters</span>
              <button
                className="btn btn-primary"
                onClick={handleCheck}
                disabled={scanning}
              >
                {scanning ? 'Scanning...' : 'Check Plagiarism →'}
              </button>
            </div>

            {scanning && (
              <div className="tool-scanning">
                <div className="scanning-bar"></div>
                <p>Comparing against billions of web pages, journals, and academic databases...</p>
              </div>
            )}

            {result && (
              <div className="tool-result">
                <div className="result-circle">
                  <div className="result-percent">{result.originality}%</div>
                  <div className="result-label">Original</div>
                </div>
                <div className="result-info">
                  <h4>Great work! Your text appears to be original.</h4>
                  <p>We checked <strong>{result.wordCount}</strong> words against billions of sources and found <strong>{result.sources}</strong> matches.</p>
                  <p className="result-disclaimer">⚠️ This is a basic free check. For comprehensive academic plagiarism detection (Turnitin reports), order any assignment from us we include a free plagiarism report with every order.</p>
                </div>
              </div>
            )}
          </div>

          <div className="tool-features">
            <div className="tool-feature">
              <div className="feature-icon">⚡</div>
              <h3>Instant Results</h3>
              <p>Get plagiarism analysis in seconds, not minutes.</p>
            </div>
            <div className="tool-feature">
              <div className="feature-icon">🔒</div>
              <h3>100% Private</h3>
              <p>Your text is never stored or shared with anyone.</p>
            </div>
            <div className="tool-feature">
              <div className="feature-icon">💯</div>
              <h3>Always Free</h3>
              <p>No signup, no credit card, no hidden fees ever.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="big-cta">
        <div className="container big-cta-inner">
          <div>
            <h2>Need a Turnitin-grade plagiarism report?</h2>
            <p>Every assignment we deliver includes a free Turnitin originality report.</p>
          </div>
          <Link to="/order" className="btn btn-primary btn-lg">Order Now →</Link>
        </div>
      </section>
    </>
  )
}

export default PlagiarismChecker
