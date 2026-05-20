import { useState } from 'react'

function Contact() {
  const [form, setForm] = useState({
    name: '', email: '', phone: '', subject: '', message: ''
  })
  const [sent, setSent] = useState(false)

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = (e) => {
    e.preventDefault()
    console.log('Contact form:', form)
    setSent(true)
    setTimeout(() => {
      setSent(false)
      setForm({ name: '', email: '', phone: '', subject: '', message: '' })
    }, 4000)
  }

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <span className="eyebrow">Contact Us</span>
          <h1 className="page-title">We'd love to hear from you.</h1>
          <p className="page-sub">Questions, feedback, or just need a quick quote? Our team is online 24/7.</p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="contact-grid">
            <div className="contact-info">
              <h2 className="section-title-left">Get in touch</h2>
              <p className="about-text">
                Whether you need help with your assignment, have a billing question, or want
                to learn more about our services we're here. Average response time is under
                4 minutes.
              </p>

              <div className="contact-methods">
                <div className="contact-method">
                  <div className="contact-icon">📞</div>
                  <div>
                    <h4>Phone</h4>
                    <p><a href="tel:+911234567890">+91 12345 67890</a></p>
                    <span className="contact-meta">24/7 support</span>
                  </div>
                </div>
                <div className="contact-method">
                  <div className="contact-icon">✉️</div>
                  <div>
                    <h4>Email</h4>
                    <p><a href="mailto:hello@easyassignments.com">hello@easyassignments.com</a></p>
                    <span className="contact-meta">Replies within 4 minutes</span>
                  </div>
                </div>
                <div className="contact-method">
                  <div className="contact-icon">💬</div>
                  <div>
                    <h4>WhatsApp</h4>
                    <p><a href="https://wa.me/911234567890" target="_blank" rel="noopener noreferrer">+91 12345 67890</a></p>
                    <span className="contact-meta">Fastest response</span>
                  </div>
                </div>
                <div className="contact-method">
                  <div className="contact-icon">📍</div>
                  <div>
                    <h4>Office</h4>
                    <p>Bihar Sharif, Bihar, India</p>
                    <span className="contact-meta">Mon–Sun, 24/7</span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              {sent ? (
                <div className="quote-card">
                  <div className="success-message">
                    <div className="success-icon">✓</div>
                    <h3>Message sent!</h3>
                    <p>Thanks for reaching out. We'll get back to you within 4 minutes.</p>
                  </div>
                </div>
              ) : (
                <div className="quote-card">
                  <div className="quote-card-head">
                    <h3>Send us a message</h3>
                    <p>We'll get back to you in under 4 minutes.</p>
                  </div>
                  <form className="quote-form" onSubmit={handleSubmit}>
                    <div className="form-row">
                      <input
                        type="text" name="name" value={form.name} onChange={handleChange}
                        placeholder="Your name" required
                      />
                    </div>
                    <div className="form-row two">
                      <input
                        type="email" name="email" value={form.email} onChange={handleChange}
                        placeholder="Email" required
                      />
                      <input
                        type="tel" name="phone" value={form.phone} onChange={handleChange}
                        placeholder="Phone (optional)"
                      />
                    </div>
                    <div className="form-row">
                      <input
                        type="text" name="subject" value={form.subject} onChange={handleChange}
                        placeholder="Subject" required
                      />
                    </div>
                    <div className="form-row">
                      <textarea
                        name="message" value={form.message} onChange={handleChange}
                        rows="5" placeholder="How can we help you?" required
                      />
                    </div>
                    <button type="submit" className="btn btn-primary btn-block">
                      Send Message →
                    </button>
                    <p className="form-note">🔒 We respect your privacy. No spam ever.</p>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="section section-alt">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">FAQ</span>
            <h2 className="section-title">Quick answers</h2>
          </div>

          <div className="faq-list">
            {[
              { q: 'How fast do you respond?', a: 'Our average response time is under 4 minutes via email, WhatsApp, or live chat. We are available 24/7.' },
              { q: 'Is my information confidential?', a: 'Absolutely. We never share your data with third parties, and your identity stays anonymous from our writers.' },
              { q: 'Can I get a refund if I am not satisfied?', a: 'Yes. We offer a full money-back guarantee if we cannot meet your requirements after revisions.' },
              { q: 'Do you offer free revisions?', a: 'Yes unlimited free revisions until you are 100% satisfied with your assignment.' },
              { q: 'How do I make payment?', a: 'We accept all major credit cards (Visa, Mastercard, American Express) and bank transfer. All payments are SSL-encrypted and 100% secure.' }
            ].map((f, i) => (
              <details key={i} className="faq-item">
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}

export default Contact
