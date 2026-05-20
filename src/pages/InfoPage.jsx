import { Link, useParams } from 'react-router-dom'

const PAGE_DATA = {
  'privacy-policy': {
    eyebrow: 'Legal',
    title: 'Privacy Policy',
    subtitle: 'How we collect, use, and protect your information.',
    lastUpdated: 'April 1, 2026',
    sections: [
      {
        heading: 'Introduction',
        content: 'At AssignPro, we take your privacy seriously. This Privacy Policy describes how we collect, use, and protect your personal information when you use our website and services. By using AssignPro, you agree to the practices described in this policy.'
      },
      {
        heading: 'Information We Collect',
        content: 'We collect information you provide directly to us including your name, email address, phone number, payment details, and any assignment requirements you share. We also automatically collect technical data such as IP address, browser type, and device information through cookies and analytics tools.'
      },
      {
        heading: 'How We Use Your Information',
        content: 'Your information is used to: deliver our services, process payments, communicate with you about your orders, send you relevant updates and offers (with your consent), improve our website, and comply with legal obligations. We never sell your personal data to third parties.'
      },
      {
        heading: 'Data Security',
        content: 'We use industry-standard security measures including SSL encryption, secure servers, and PCI-compliant payment processing. Your assignment files and personal data are protected with multi-layer security protocols. While no system is 100% secure, we follow best practices to protect your information.'
      },
      {
        heading: 'Confidentiality',
        content: 'Your identity is kept strictly confidential. Our writers know you only by an anonymous customer ID never your real name or institution. We never share your details with your university or any third party. Your relationship with AssignPro stays completely private.'
      },
      {
        heading: 'Cookies',
        content: 'We use cookies to remember your preferences, analyze website traffic, and improve user experience. You can control cookies through your browser settings, but disabling them may affect site functionality.'
      },
      {
        heading: 'Your Rights',
        content: 'You have the right to access, correct, or delete your personal data at any time. You can also request a copy of all data we hold about you, or opt out of marketing communications. Contact us at hello@assignpro.com to exercise these rights.'
      },
      {
        heading: 'Changes to This Policy',
        content: 'We may update this Privacy Policy occasionally to reflect changes in our practices or legal requirements. We will notify you of significant changes via email or a prominent website notice.'
      },
      {
        heading: 'Contact Us',
        content: 'If you have questions about this Privacy Policy, contact us at hello@assignpro.com or via our Contact page.'
      }
    ]
  },

  'terms-conditions': {
    eyebrow: 'Legal',
    title: 'Terms & Conditions',
    subtitle: 'The rules and guidelines for using AssignPro.',
    lastUpdated: 'April 1, 2026',
    sections: [
      {
        heading: 'Acceptance of Terms',
        content: 'By accessing AssignPro, you agree to be bound by these Terms & Conditions. If you disagree with any part, please discontinue use of our services. These terms apply to all users visitors, customers, and registered members.'
      },
      {
        heading: 'Service Description',
        content: 'AssignPro is an academic support service providing reference papers, tutoring, editing, and consulting services to students worldwide. All work delivered is intended as a learning aid and reference material to help students improve their own academic skills.'
      },
      {
        heading: 'User Responsibilities',
        content: 'You agree to: provide accurate information when placing orders, use our work as a reference (not as your own submission), follow your institution\'s academic integrity policies, not share login credentials, and respect intellectual property rights.'
      },
      {
        heading: 'Payment Terms',
        content: 'All prices are listed in USD unless otherwise specified. Payment is due before work begins. We accept major credit cards (Visa, Mastercard, Amex) and bank transfer. All transactions are processed through secure, PCI-compliant gateways.'
      },
      {
        heading: 'Refund Policy',
        content: 'We offer a money-back guarantee under specific conditions: significant deviation from your instructions, missed deadlines on our part, or major quality issues. Refund requests must be submitted within 14 days of delivery with detailed justification. Approved refunds are processed within 5-10 business days.'
      },
      {
        heading: 'Revisions',
        content: 'We provide unlimited free revisions to ensure your satisfaction. Revision requests must align with the original instructions and be submitted within 14 days of delivery.'
      },
      {
        heading: 'Intellectual Property',
        content: 'Upon full payment, you receive a non-exclusive license to use the delivered work for your personal academic purposes. AssignPro retains ownership rights, and the work may not be redistributed, resold, or published without permission.'
      },
      {
        heading: 'Limitation of Liability',
        content: 'AssignPro is not liable for any indirect, incidental, or consequential damages arising from use of our services. Our maximum liability is limited to the amount you paid for the specific service in question.'
      },
      {
        heading: 'Modifications',
        content: 'We reserve the right to modify these terms at any time. Continued use of our services after changes constitutes acceptance of the updated terms.'
      },
      {
        heading: 'Governing Law',
        content: 'These terms are governed by international commerce laws applicable in our jurisdiction. Any disputes will be resolved through arbitration before pursuing legal action.'
      }
    ]
  },

  'honor-code': {
    eyebrow: 'Academic Integrity',
    title: 'Honor Code',
    subtitle: 'Our commitment to academic integrity and ethical use of our services.',
    lastUpdated: 'April 1, 2026',
    sections: [
      {
        heading: 'Our Commitment',
        content: 'AssignPro is an academic support service committed to helping students learn, grow, and succeed. We provide reference materials, tutoring, and editing services that supplement not replace a student\'s own learning journey.'
      },
      {
        heading: 'Intended Use of Our Work',
        content: 'All papers, code, and materials delivered by AssignPro are model answers and reference materials. They are intended to: help you understand complex topics, demonstrate proper academic structure and citation, provide examples of high-quality work, and support your own original writing process.'
      },
      {
        heading: 'What Students Should NOT Do',
        content: 'We strictly do not endorse: submitting our work directly as your own original submission, paraphrasing our work without proper attribution, using our work in ways that violate your institution\'s academic integrity policies, or any form of academic dishonesty.'
      },
      {
        heading: 'Encouraged Practices',
        content: 'We strongly encourage students to: use our work as a learning resource, take inspiration from structure and approach, properly cite any direct use of our content, follow your institution\'s policies on collaboration and external help, and develop your own independent thinking and writing skills.'
      },
      {
        heading: 'Confidentiality',
        content: 'Your privacy is paramount. We never disclose your identity, institution, or any details about our work together. Our writers know you only by an anonymous customer ID.'
      },
      {
        heading: 'Originality Guarantee',
        content: 'Every piece of work delivered by AssignPro is original, written from scratch, and verified for plagiarism through Turnitin. We do not recycle papers or sell pre-written content.'
      },
      {
        heading: 'Educational Mission',
        content: 'Our ultimate goal is your academic growth and learning. We believe in education that builds skills, critical thinking, and confidence not shortcuts that undermine learning.'
      }
    ]
  },

  'sample-papers': {
    eyebrow: 'Free Resources',
    title: 'Sample Papers',
    subtitle: 'Browse free sample papers across all subjects to see the quality of our work.',
    lastUpdated: 'Updated weekly',
    sections: [
      {
        heading: 'Why Sample Papers?',
        content: 'Sample papers are an excellent way to see exactly what you\'ll receive when you order with AssignPro. Each sample shows our research depth, writing quality, citation accuracy, and formatting standards. Use them as a benchmark for your own work or as inspiration for structure and approach.'
      },
      {
        heading: 'How to Use Samples',
        content: 'Sample papers are provided for educational purposes only. You are welcome to read them, learn from their structure, and use them as a reference. However, please do not submit them as your own work that violates academic integrity policies and our honor code.'
      },
      {
        heading: 'Available Sample Categories',
        content: 'Our sample library covers: Essays (argumentative, expository, persuasive), Research papers, Case studies, Dissertations and theses (chapter samples), Lab reports, Programming projects (Java, Python, C++), Business reports and analyses, Literature reviews, and more across all 75+ subjects we cover.'
      },
      {
        heading: 'Quality You Can Trust',
        content: 'Every sample on our platform is original, plagiarism-free, and written by our verified PhD experts. Samples represent the same quality you\'ll receive when you order no exceptions.'
      },
      {
        heading: 'Request Custom Samples',
        content: 'Looking for a sample in a specific subject or topic? Contact our support team and we\'ll provide relevant examples. Or simply place a free quote there\'s no commitment until you approve the writer and the price.'
      }
    ],
    cta: { text: 'Want a custom paper for your specific assignment?', button: 'Get Free Quote' }
  },

  'citation-generator': {
    eyebrow: 'Free Tool',
    title: 'Citation Generator',
    subtitle: 'Generate accurate citations in APA, MLA, Harvard, and Chicago styles.',
    lastUpdated: 'Free forever',
    sections: [
      {
        heading: 'About the Citation Generator',
        content: 'Our free citation generator helps you create properly formatted citations for your academic papers. Whether you need APA 7th edition, MLA 9th edition, Harvard, or Chicago style we\'ve got you covered. Simply enter your source details and get instant, accurate citations.'
      },
      {
        heading: 'Supported Citation Styles',
        content: 'We support the four most-used citation styles in academia: APA (American Psychological Association) used in psychology, education, sciences. MLA (Modern Language Association) used in humanities, English, literature. Harvard used in UK and Australian universities. Chicago used in history, arts, theology.'
      },
      {
        heading: 'Source Types We Support',
        content: 'Generate citations for: Books and book chapters, Journal articles (print and online), Websites and online articles, Newspapers and magazines, Government documents, Conference papers, Theses and dissertations, Videos and podcasts, Social media posts, and more.'
      },
      {
        heading: 'Why Citations Matter',
        content: 'Accurate citations are essential to academic integrity they give credit to original authors, allow readers to verify your sources, demonstrate the depth of your research, and protect you from accidental plagiarism. Wrong citations can cost you marks, even with great content.'
      },
      {
        heading: 'Coming Soon',
        content: 'Our interactive citation generator tool is currently in development. In the meantime, our PhD experts can format any paper in your required citation style as part of any assignment order completely free.'
      }
    ],
    cta: { text: 'Need help formatting your entire paper?', button: 'Order Now' }
  },

  'become-an-affiliate': {
    eyebrow: 'Earn With Us',
    title: 'Become an Affiliate',
    subtitle: 'Earn up to 30% commission for every student you refer to AssignPro.',
    lastUpdated: 'Open for applications',
    sections: [
      {
        heading: 'Why Join Our Affiliate Program?',
        content: 'AssignPro\'s affiliate program is one of the most generous in the academic services industry. Whether you run a student blog, YouTube channel, social media account, or just have friends who need help earn a substantial commission for every referral that converts to a paying customer.'
      },
      {
        heading: 'Commission Structure',
        content: 'New affiliates start at 15% commission per successful referral. As you refer more customers, you can level up to 20%, 25%, or even 30% commission. Top affiliates earn $5,000+ per month in passive income. There\'s no cap on earnings.'
      },
      {
        heading: 'How It Works',
        content: 'Sign up for free in 2 minutes. Get your unique tracking link and marketing materials. Share with students, on social media, your blog, or in your network. Earn commission on every paying customer who uses your link even on their repeat orders. Get paid monthly via PayPal, bank transfer, or wire.'
      },
      {
        heading: 'Marketing Materials Provided',
        content: 'We provide everything you need to succeed: Custom banners and graphics in multiple sizes, Pre-written email and social media templates, Landing pages optimized for conversion, Detailed analytics dashboard, Monthly performance reports, Dedicated affiliate support team.'
      },
      {
        heading: 'Who Can Become an Affiliate?',
        content: 'Anyone can join students, bloggers, content creators, educators, study group leaders, university clubs, and more. We especially welcome partners with active student audiences. There are no minimum requirements to join, just a passion for helping students succeed.'
      },
      {
        heading: 'Apply Today',
        content: 'Ready to start earning? Email us at affiliates@assignpro.com or use our Contact page to apply. Our affiliate manager will review your application and onboard you within 48 hours. Most affiliates start earning their first commission within 7 days of joining.'
      }
    ],
    cta: { text: 'Ready to earn with AssignPro?', button: 'Contact Us', link: '/contact' }
  }
}

function InfoPage() {
  const { slug } = useParams()
  const data = PAGE_DATA[slug]

  if (!data) {
    return (
      <section className="page-hero" style={{ minHeight: '60vh' }}>
        <div className="container" style={{ textAlign: 'center', padding: '60px 0' }}>
          <span className="eyebrow">404 Not Found</span>
          <h1 className="page-title">Page Not Found</h1>
          <p className="page-sub">The page you're looking for doesn't exist.</p>
          <Link to="/" className="btn btn-primary" style={{ marginTop: '24px' }}>← Back to Home</Link>
        </div>
      </section>
    )
  }

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <span className="eyebrow">{data.eyebrow}</span>
          <h1 className="page-title">{data.title}</h1>
          <p className="page-sub">{data.subtitle}</p>
          <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '12px' }}>
            Last updated: {data.lastUpdated}
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container" style={{ maxWidth: '820px' }}>
          <div className="info-page-content">
            {data.sections.map((section, i) => (
              <div key={i} className="info-section">
                <h2>{section.heading}</h2>
                <p>{section.content}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="big-cta">
        <div className="container big-cta-inner">
          <div>
            <h2>{data.cta?.text || 'Have questions?'}</h2>
            <p>Our team is online 24/7 average response time is 4 minutes.</p>
          </div>
          <Link to={data.cta?.link || '/order'} className="btn btn-primary btn-lg">
            {data.cta?.button || 'Order Now'} →
          </Link>
        </div>
      </section>
    </>
  )
}

export default InfoPage
