/* eslint-disable react/no-unescaped-entities */
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const metadata = {
  title: "Privacy Policy - CircuitSnips",
  description: "Privacy policy for CircuitSnips, the open-source KiCad circuit sharing platform",
};

export default function PrivacyPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
        <div className="prose prose-slate dark:prose-invert max-w-none">
          <p className="text-muted-foreground mb-8">
            <strong>Last Updated:</strong> January 2025
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
            <p>
              CircuitSnips (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use our open-source platform for sharing KiCad schematic subcircuits.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">2. Information We Collect</h2>

            <h3 className="text-xl font-semibold mb-3">2.1 Account Information</h3>
            <p>When you create an account via GitHub OAuth, we collect:</p>
            <ul className="list-disc pl-6 mb-4">
              <li>GitHub username</li>
              <li>GitHub profile picture (avatar)</li>
              <li>GitHub profile URL</li>
              <li>Email address (if publicly available)</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3">2.2 User-Generated Content</h3>
            <p>We store content you voluntarily upload:</p>
            <ul className="list-disc pl-6 mb-4">
              <li>KiCad schematic files (S-expressions)</li>
              <li>Circuit metadata (titles, descriptions, tags)</li>
              <li>Circuit thumbnails (generated from schematics)</li>
              <li>Comments on circuits</li>
              <li>Profile information (bio, website)</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3">2.3 Usage Data</h3>
            <p>We collect anonymous usage statistics via Vercel Analytics:</p>
            <ul className="list-disc pl-6 mb-4">
              <li>Page views and visitor counts</li>
              <li>Referral sources</li>
              <li>Browser and device information</li>
              <li>Geographic region (country-level only)</li>
            </ul>
            <p>
              <strong>Note:</strong> Vercel Analytics is privacy-friendly and does not use cookies or track individual users.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">3. How We Use Your Information</h2>
            <p>We use collected information to:</p>
            <ul className="list-disc pl-6">
              <li>Provide and maintain the CircuitSnips platform</li>
              <li>Authenticate users and manage accounts</li>
              <li>Display your public profile and uploaded circuits</li>
              <li>Enable community features (comments, favorites)</li>
              <li>Track circuit usage statistics (views, copies)</li>
              <li>Improve platform performance and user experience</li>
              <li>Prevent abuse and enforce our Terms of Service</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">4. Cookies and Tracking</h2>
            <p>
              CircuitSnips uses only <strong>essential cookies</strong> necessary for authentication and platform functionality:
            </p>
            <ul className="list-disc pl-6 mb-4">
              <li>Supabase authentication cookies (httpOnly, secure)</li>
              <li>Session management cookies</li>
            </ul>
            <p>
              We do <strong>not</strong> use third-party tracking cookies, advertising cookies, or marketing cookies.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">5. Data Storage and Security</h2>
            <p>Your data is stored securely using:</p>
            <ul className="list-disc pl-6 mb-4">
              <li><strong>Supabase:</strong> PostgreSQL database with Row-Level Security (RLS) policies</li>
              <li><strong>Vercel:</strong> Hosting infrastructure with HTTPS encryption</li>
              <li><strong>GitHub:</strong> OAuth authentication (no passwords stored)</li>
            </ul>
            <p>
              All data transmission is encrypted using TLS/SSL. We implement industry-standard security measures including rate limiting, input validation, and secure authentication.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">6. Data Sharing and Third Parties</h2>
            <p>
              We do <strong>not</strong> sell, rent, or share your personal information with third parties for marketing purposes.
            </p>
            <p>We share data only with essential service providers:</p>
            <ul className="list-disc pl-6">
              <li><strong>Supabase:</strong> Database and authentication services</li>
              <li><strong>GitHub:</strong> OAuth authentication provider</li>
              <li><strong>Vercel:</strong> Hosting and analytics (privacy-friendly, no cookies)</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">7. Public Content</h2>
            <p>
              All circuits you upload are <strong>public by default</strong> and visible to all users. When you upload a circuit, you agree to share it under the open-source license you select (e.g., MIT, CERN-OHL-S-2.0).
            </p>
            <p>
              Your profile information (username, avatar, bio, website) is also public.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">8. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-6 mb-4">
              <li><strong>Access:</strong> View all personal data we hold about you</li>
              <li><strong>Update:</strong> Modify your profile and account information</li>
              <li><strong>Delete:</strong> Request deletion of your account and associated data</li>
              <li><strong>Export:</strong> Download your uploaded circuits and data</li>
            </ul>
            <p>
              To exercise these rights, visit your account settings or contact us at the email below.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">9. Data Retention</h2>
            <p>
              We retain your data for as long as your account is active. When you delete your account:
            </p>
            <ul className="list-disc pl-6">
              <li>Your profile and personal information are permanently deleted</li>
              <li>Your uploaded circuits and comments are removed from the platform</li>
              <li>Cached and backup data is deleted within 30 days</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">10. Children's Privacy</h2>
            <p>
              CircuitSnips is not intended for users under 13 years of age. We do not knowingly collect personal information from children under 13. If you believe we have collected data from a child, please contact us immediately.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">11. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated "Last Updated" date. Continued use of CircuitSnips after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">12. Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy or your data, please contact us:
            </p>
            <ul className="list-none pl-0 mt-4">
              <li><strong>Email:</strong> privacy@circuitsnips.mikeayles.com</li>
              <li><strong>GitHub:</strong> <a href="https://github.com/MichaelAyles/kicad-library" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">github.com/MichaelAyles/kicad-library</a></li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">13. GDPR Compliance (EU Users)</h2>
            <p>
              For users in the European Union, we comply with the General Data Protection Regulation (GDPR):
            </p>
            <ul className="list-disc pl-6">
              <li><strong>Legal Basis:</strong> Consent (account creation) and legitimate interest (platform operation)</li>
              <li><strong>Data Controller:</strong> CircuitSnips</li>
              <li><strong>Data Processor:</strong> Supabase (data hosting)</li>
              <li><strong>Your Rights:</strong> Access, rectification, erasure, data portability, and objection</li>
            </ul>
            <p>
              To exercise your GDPR rights, contact us at the email address above.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
