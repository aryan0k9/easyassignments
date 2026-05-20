import { useState } from 'react'
import { MessageCircle, X, Send, Phone, Headphones, ArrowLeft, Mail, User } from 'lucide-react'
import { supabase } from '../lib/supabase'
import '../styles/live-chat.css'

function WhatsAppFloat() {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('options') // options | live
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    message: ''
  })

  const whatsappNumber = '911234567890'

  const handleChange = (e) => {
    setForm(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  const handleStartLiveChat = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!form.fullName.trim() || !form.email.trim() || !form.message.trim()) {
      setError('Please fill all fields to start conversation.')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.from('messages').insert([
        {
          sender_name: form.fullName.trim(),
          sender_email: form.email.trim().toLowerCase(),
          message: form.message.trim(),
          content: form.message.trim(),
          read: false
        }
      ])

      if (error) {
        console.error('Live chat save error:', error)
        setError('Message could not be sent. Please use WhatsApp for now.')
        setLoading(false)
        return
      }

      setSuccess('Conversation started. Our support team will reply soon.')
      setForm({
        fullName: '',
        email: '',
        message: ''
      })
    } catch (err) {
      console.error('Live chat error:', err)
      setError('Something went wrong. Please try WhatsApp.')
    } finally {
      setLoading(false)
    }
  }

  const openWhatsApp = () => {
    const text = encodeURIComponent(
      'Hi Easy Assignments, I need help with my assignment.'
    )
    window.open(`https://wa.me/${whatsappNumber}?text=${text}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="ea-chat-widget">
      {open && (
        <div className="ea-chat-panel">
          {mode === 'options' && (
            <>
              <div className="ea-chat-hero">
                <div className="ea-chat-brand">
                  <div className="ea-chat-logo">E</div>
                  <div>
                    <h3>Chat with Real Person 👋</h3>
                    <p>We do not believe in automated bot replies.</p>
                  </div>
                </div>
              </div>

              <div className="ea-chat-body">
                <button className="ea-chat-option whatsapp" onClick={openWhatsApp}>
                  <div className="ea-chat-option-icon">💬</div>
                  <div>
                    <strong>Continue on WhatsApp</strong>
                    <span>Fastest reply from our support team</span>
                  </div>
                  <span className="ea-chat-option-arrow">→</span>
                </button>

                <button className="ea-chat-option live" onClick={() => setMode('live')}>
                  <div className="ea-chat-option-icon">🎧</div>
                  <div>
                    <strong>Start Live Chat</strong>
                    <span>Share your details and message</span>
                  </div>
                  <span className="ea-chat-option-arrow">→</span>
                </button>

                <div className="ea-chat-away-card">
                  <strong>We are online</strong>
                  <span>Typically replies in a few minutes</span>
                </div>
              </div>
            </>
          )}

          {mode === 'live' && (
            <>
              <div className="ea-chat-live-header">
                <button
                  type="button"
                  className="ea-chat-back"
                  onClick={() => {
                    setMode('options')
                    setError('')
                    setSuccess('')
                  }}
                >
                  <ArrowLeft size={20} />
                </button>

                <div className="ea-chat-live-title">
                  <h3>EasyAssignments Help <span></span></h3>
                  <p>Typically replies in a few minutes</p>
                </div>
              </div>

              <div className="ea-chat-live-body">
                <p className="ea-chat-intro">
                  We need a few details to assist you better.
                </p>

                {error && <div className="ea-chat-alert error">{error}</div>}
                {success && <div className="ea-chat-alert success">{success}</div>}

                <form onSubmit={handleStartLiveChat} className="ea-chat-form">
                  <label>
                    Full Name
                    <div className="ea-chat-input-wrap">
                      <User size={17} />
                      <input
                        type="text"
                        name="fullName"
                        placeholder="Please enter your full name"
                        value={form.fullName}
                        onChange={handleChange}
                      />
                    </div>
                  </label>

                  <label>
                    Email Address
                    <div className="ea-chat-input-wrap">
                      <Mail size={17} />
                      <input
                        type="email"
                        name="email"
                        placeholder="Please enter your email address"
                        value={form.email}
                        onChange={handleChange}
                      />
                    </div>
                  </label>

                  <label>
                    Message
                    <textarea
                      name="message"
                      placeholder="Please enter your message"
                      value={form.message}
                      onChange={handleChange}
                    />
                  </label>

                  <button type="submit" className="ea-chat-submit" disabled={loading}>
                    {loading ? 'Starting...' : (
                      <>
                        Start Conversation <Send size={16} />
                      </>
                    )}
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      )}

      <button
        type="button"
        className={`ea-chat-float ${open ? 'open' : ''}`}
        onClick={() => setOpen(prev => !prev)}
        aria-label="Open support chat"
      >
        {open ? <X size={34} /> : <MessageCircle size={32} />}
      </button>
    </div>
  )
}

export default WhatsAppFloat