import { useSearchParams } from 'react-router-dom'
import QuoteForm from '../components/QuoteForm'
import { PaymentCardIcons } from '../components/PaymentIcons'

function Order() {
  const [searchParams] = useSearchParams()
  const service = searchParams.get('service') || ''
  const expertName = searchParams.get('expert') || ''
  const expertAvatar = searchParams.get('expertAvatar') || ''

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <span className="eyebrow">{service || 'Place an Order'}</span>
          <h1 className="page-title">
            {service
              ? `${service} - Expert help in 3 simple steps.`
              : 'Get your assignment done in 3 simple steps.'}
          </h1>
          <p className="page-sub">Fill the form, get matched with an expert, and receive top-quality work on time.</p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="order-grid">
            <div>
              <h2 className="section-title-left">Why order with us?</h2>
              <ul className="order-benefits">
                <li>
                  <strong>✓ No upfront payment</strong>
                  <span>Get a free quote first. Pay only after you approve the writer.</span>
                </li>
                <li>
                  <strong>✓ Pick your own expert</strong>
                  <span>Browse 2,000+ verified PhDs and choose the one that fits your subject.</span>
                </li>
                <li>
                  <strong>✓ Free plagiarism report</strong>
                  <span>Every order includes a complimentary Turnitin originality check.</span>
                </li>
                <li>
                  <strong>✓ On-time delivery guaranteed</strong>
                  <span>98.2% of our orders arrive before deadline or full refund.</span>
                </li>
                <li>
                  <strong>✓ Free unlimited revisions</strong>
                  <span>We refine your work until you're 100% satisfied. No extra charge.</span>
                </li>
                <li>
                  <strong>✓ 24/7 support</strong>
                  <span>Real humans, not chatbots. Average response time: 4 minutes.</span>
                </li>
                <li>
                  <strong>✓ Money-back guarantee</strong>
                  <span>Not happy? Full refund no questions asked.</span>
                </li>
              </ul>

              <div className="order-payments">
                <h4>Secure payment methods</h4>
                <PaymentCardIcons width={52} height={33} gap={8} />
              </div>
            </div>

            <div className="order-form-wrap">
              <QuoteForm
                title={service ? `Order: ${service}` : 'Place your order'}
                subtitle="Free quote in 4 minutes. No payment until you approve."
                defaultService={service}
                expertName={expertName}
                expertAvatar={expertAvatar}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="section section-alt">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">How it Works</span>
            <h2 className="section-title">From order to delivery</h2>
          </div>

          <div className="steps-grid">
            <div className="step-card">
              <div className="step-num">01</div>
              <h3>Submit Order</h3>
              <p>Fill the form with your subject, deadline, and requirements. Upload any reference files.</p>
            </div>
            <div className="step-arrow">→</div>
            <div className="step-card">
              <div className="step-num">02</div>
              <h3>Get Matched</h3>
              <p>We assign the best PhD expert in your field within 4 minutes. Confirm and pay securely.</p>
            </div>
            <div className="step-arrow">→</div>
            <div className="step-card">
              <div className="step-num">03</div>
              <h3>Receive Work</h3>
              <p>Get your finished assignment with free plagiarism report. Request free revisions anytime.</p>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

export default Order
