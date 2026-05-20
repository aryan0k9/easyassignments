import { useState } from 'react'
import { Link } from 'react-router-dom'

function WordCounter() {
  const [text, setText] = useState('')

  const words = text.trim() ? text.trim().split(/\s+/).length : 0
  const characters = text.length
  const charactersNoSpaces = text.replace(/\s/g, '').length
  const sentences = text.trim() ? text.split(/[.!?]+/).filter(s => s.trim()).length : 0
  const paragraphs = text.trim() ? text.split(/\n\s*\n/).filter(p => p.trim()).length : 0
  const readingTime = Math.max(1, Math.ceil(words / 200))
  const speakingTime = Math.max(1, Math.ceil(words / 130))

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <span className="eyebrow">Free Tool</span>
          <h1 className="page-title">Word Counter</h1>
          <p className="page-sub">Count words, characters, sentences, paragraphs, and reading time all in real-time. 100% free.</p>
        </div>
      </section>

      <section className="section">
        <div className="container" style={{ maxWidth: '1100px' }}>
          <div className="word-counter-grid">
            <div className="tool-card">
              <h3 className="tool-card-title">Paste or type your text</h3>
              <textarea
                className="tool-textarea"
                placeholder="Start typing or paste your text here..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={16}
              />
              <button
                className="btn btn-outline"
                onClick={() => setText('')}
                style={{ marginTop: '8px' }}
              >
                Clear Text
              </button>
            </div>

            <div className="word-counter-stats">
              <div className="word-stat">
                <div className="word-stat-num">{words.toLocaleString()}</div>
                <div className="word-stat-label">Words</div>
              </div>
              <div className="word-stat">
                <div className="word-stat-num">{characters.toLocaleString()}</div>
                <div className="word-stat-label">Characters</div>
              </div>
              <div className="word-stat">
                <div className="word-stat-num">{charactersNoSpaces.toLocaleString()}</div>
                <div className="word-stat-label">Characters (no spaces)</div>
              </div>
              <div className="word-stat">
                <div className="word-stat-num">{sentences.toLocaleString()}</div>
                <div className="word-stat-label">Sentences</div>
              </div>
              <div className="word-stat">
                <div className="word-stat-num">{paragraphs.toLocaleString()}</div>
                <div className="word-stat-label">Paragraphs</div>
              </div>
              <div className="word-stat">
                <div className="word-stat-num">{readingTime} min</div>
                <div className="word-stat-label">Reading Time</div>
              </div>
              <div className="word-stat">
                <div className="word-stat-num">{speakingTime} min</div>
                <div className="word-stat-label">Speaking Time</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="big-cta">
        <div className="container big-cta-inner">
          <div>
            <h2>Need help with your assignment?</h2>
            <p>Get matched with a PhD expert in your subject free quote in 4 minutes.</p>
          </div>
          <Link to="/order" className="btn btn-primary btn-lg">Order Now →</Link>
        </div>
      </section>
    </>
  )
}

export default WordCounter
