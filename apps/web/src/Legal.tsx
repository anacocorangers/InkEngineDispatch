import './Legal.css'

const effectiveDate = 'August 5, 2026'

function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className='legal-shell'>
      <header>
        <p className='legal-kicker'>InkEngine Dispatch</p>
        <h1>{title}</h1>
        <p>Effective {effectiveDate}</p>
      </header>
      <article className='legal-copy'>{children}</article>
      <footer className='legal-footer'>
        <a href='/'>Return to Dispatch</a>
        <a href='/terms'>Terms of Service</a>
        <a href='/privacy'>Privacy Policy</a>
      </footer>
    </main>
  )
}

export function TermsPage() {
  return (
    <LegalPage title='Terms of Service'>
      <section>
        <h2>Service</h2>
        <p>InkEngine Dispatch is a read-only community information service that collects and links to War of Rights news, media, event announcements, and public community reports from approved sources.</p>
      </section>
      <section>
        <h2>Acceptable Use</h2>
        <p>You may use Dispatch for lawful, personal, and community purposes. You may not disrupt the service, attempt unauthorized access, misuse source content, or use Dispatch to harass others or violate a source platform's terms.</p>
      </section>
      <section>
        <h2>Third-Party Content</h2>
        <p>Dispatch links to content hosted by third parties, including Discord, Reddit, Steam, Twitch, YouTube, and the War of Rights website. That content remains subject to its owner's rights and the source platform's terms. Inclusion does not imply endorsement.</p>
      </section>
      <section>
        <h2>Discord Bot</h2>
        <p>The InkEngine Dispatch bot reads messages only from channels explicitly selected by a server administrator. It does not post messages, moderate servers, send direct messages, or access channels where it lacks permission. Server administrators are responsible for choosing appropriate channels and permissions.</p>
      </section>
      <section>
        <h2>Availability and Changes</h2>
        <p>The service is provided as available, without guarantees of uninterrupted operation, completeness, or accuracy. Sources may remove or change content at any time. These terms may be updated as the service changes.</p>
      </section>
      <section>
        <h2>Contact</h2>
        <p>Questions or removal requests may be submitted through the <a href='https://github.com/anacocorangers/InkEngineDispatch/issues'>InkEngine Dispatch issue tracker</a>.</p>
      </section>
    </LegalPage>
  )
}

export function PrivacyPage() {
  return (
    <LegalPage title='Privacy Policy'>
      <section>
        <h2>Information Processed</h2>
        <p>Dispatch processes public or administrator-approved source content needed to create feed entries. For selected Discord channels, this can include message text, message and channel identifiers, author display names, timestamps, attachment URLs, and links to original messages.</p>
      </section>
      <section>
        <h2>How Information Is Used</h2>
        <p>Information is used only to display relevant War of Rights reports, prevent duplicate entries, monitor source health, and link visitors to original content. Dispatch does not sell personal information, build user profiles, serve targeted advertising, or use source content to train AI models.</p>
      </section>
      <section>
        <h2>Storage and Retention</h2>
        <p>Feed records may be retained to provide the service and avoid duplicates. Access credentials are stored in managed secret storage and are not committed to source control. Source content may be refreshed, removed, or become unavailable when an original source changes.</p>
      </section>
      <section>
        <h2>Sharing</h2>
        <p>Dispatch displays source attribution and links to original content. It does not disclose collected information to data brokers. Infrastructure providers may process limited technical data as necessary to host and secure the service.</p>
      </section>
      <section>
        <h2>Choices and Requests</h2>
        <p>Discord server administrators can revoke the bot's access or remove it at any time. Questions, correction requests, or removal requests may be submitted through the <a href='https://github.com/anacocorangers/InkEngineDispatch/issues'>InkEngine Dispatch issue tracker</a>.</p>
      </section>
    </LegalPage>
  )
}