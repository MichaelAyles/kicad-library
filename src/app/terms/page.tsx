/* eslint-disable react/no-unescaped-entities */
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const metadata = {
  title: "Terms of Service - CircuitSnips",
  description: "Terms of Service for CircuitSnips, the open-source KiCad circuit sharing platform",
};

export default function TermsPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
        <div className="prose prose-slate dark:prose-invert max-w-none">
          <p className="text-muted-foreground mb-8">
            <strong>Last Updated:</strong> January 2025
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
            <p>
              By accessing or using CircuitSnips ("the Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, please do not use the Service.
            </p>
            <p>
              CircuitSnips is an open-source platform for sharing KiCad schematic subcircuits. The platform itself is licensed under the MIT License.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">2. User Accounts</h2>

            <h3 className="text-xl font-semibold mb-3">2.1 Account Creation</h3>
            <p>
              To upload circuits and participate in the community, you must create an account using GitHub OAuth. You are responsible for:
            </p>
            <ul className="list-disc pl-6 mb-4">
              <li>Maintaining the security of your GitHub account</li>
              <li>All activities that occur under your account</li>
              <li>Providing accurate profile information</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3">2.2 Account Termination</h3>
            <p>
              You may delete your account at any time through your account settings. We reserve the right to suspend or terminate accounts that violate these Terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">3. User Content and Licensing</h2>

            <h3 className="text-xl font-semibold mb-3">3.1 Your Content</h3>
            <p>
              When you upload circuits to CircuitSnips, you retain all ownership rights to your content. However, you must choose an open-source hardware license for each circuit you upload.
            </p>

            <h3 className="text-xl font-semibold mb-3">3.2 Supported Licenses</h3>
            <p>We support the following open-source hardware licenses:</p>
            <ul className="list-disc pl-6 mb-4">
              <li>CERN-OHL-S-2.0 (recommended)</li>
              <li>MIT License</li>
              <li>Creative Commons BY 4.0</li>
              <li>Creative Commons BY-SA 4.0</li>
              <li>GPL-3.0</li>
              <li>Apache-2.0</li>
              <li>TAPR-OHL-1.0</li>
              <li>BSD-2-Clause</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3">3.3 License Grant</h3>
            <p>
              By uploading a circuit, you grant all users the right to use, copy, modify, and distribute your circuit under the terms of the license you selected. This grant is irrevocable.
            </p>

            <h3 className="text-xl font-semibold mb-3">3.4 Attribution</h3>
            <p>
              CircuitSnips automatically embeds attribution information (author, license, source URL) into downloaded circuits. Users who download your circuits must provide proper attribution as required by the license you selected.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">4. Acceptable Use</h2>
            <p>You agree <strong>not</strong> to:</p>
            <ul className="list-disc pl-6 mb-4">
              <li>Upload circuits you do not have the right to share</li>
              <li>Violate any intellectual property rights</li>
              <li>Upload malicious, harmful, or illegal content</li>
              <li>Harass, abuse, or harm other users</li>
              <li>Spam or engage in fraudulent activity</li>
              <li>Attempt to bypass rate limiting or security measures</li>
              <li>Scrape or abuse the platform's APIs</li>
              <li>Upload content that violates export control laws</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">5. Intellectual Property</h2>

            <h3 className="text-xl font-semibold mb-3">5.1 Platform Code</h3>
            <p>
              The CircuitSnips platform itself is open-source software licensed under the MIT License. You may view, fork, and contribute to the source code on GitHub.
            </p>

            <h3 className="text-xl font-semibold mb-3">5.2 User Circuits</h3>
            <p>
              Each circuit uploaded to CircuitSnips is licensed under the specific open-source license chosen by its author. Check each circuit's license before using it in your projects.
            </p>

            <h3 className="text-xl font-semibold mb-3">5.3 Trademarks</h3>
            <p>
              "CircuitSnips" and the CircuitSnips logo are trademarks. "KiCad" is a trademark of the KiCad project. All trademarks belong to their respective owners.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">6. Content Moderation</h2>
            <p>
              We reserve the right to remove content that:
            </p>
            <ul className="list-disc pl-6 mb-4">
              <li>Violates these Terms of Service</li>
              <li>Infringes intellectual property rights</li>
              <li>Contains malicious or harmful code</li>
              <li>Is reported as inappropriate by the community</li>
            </ul>
            <p>
              We will make reasonable efforts to notify you before removing content, except in cases of clear legal violations.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">7. Disclaimer of Warranties</h2>
            <p>
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT:
            </p>
            <ul className="list-disc pl-6 mb-4">
              <li>The Service will be uninterrupted, secure, or error-free</li>
              <li>Uploaded circuits are free from errors or defects</li>
              <li>Circuits will work as intended in your projects</li>
              <li>The platform will meet your specific requirements</li>
            </ul>
            <p>
              <strong>USE CIRCUITS AT YOUR OWN RISK.</strong> Always verify and test circuits before using them in production designs, especially for safety-critical applications.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">8. Limitation of Liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO:
            </p>
            <ul className="list-disc pl-6 mb-4">
              <li>Loss of data or content</li>
              <li>Loss of profits or business</li>
              <li>Damage from faulty circuits</li>
              <li>Service interruptions or data breaches</li>
            </ul>
            <p>
              OUR TOTAL LIABILITY SHALL NOT EXCEED $100 USD.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">9. DMCA and Copyright</h2>
            <p>
              We respect intellectual property rights. If you believe content on CircuitSnips infringes your copyright, please contact us with:
            </p>
            <ul className="list-disc pl-6 mb-4">
              <li>Description of the copyrighted work</li>
              <li>URL of the allegedly infringing content</li>
              <li>Your contact information</li>
              <li>A statement of good faith belief</li>
              <li>A statement under penalty of perjury</li>
              <li>Physical or electronic signature</li>
            </ul>
            <p>
              Send DMCA notices to: <strong>dmca@circuitsnips.mikeayles.com</strong>
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">10. Privacy</h2>
            <p>
              Your use of the Service is also governed by our <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>. Please review it to understand how we collect and use your data.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">11. Changes to Terms</h2>
            <p>
              We may modify these Terms at any time. Changes will be posted on this page with an updated "Last Updated" date. Continued use of the Service after changes constitutes acceptance of the new Terms.
            </p>
            <p>
              For significant changes, we will provide notice via email or a prominent platform announcement.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">12. Governing Law</h2>
            <p>
              These Terms are governed by the laws of the jurisdiction where the platform is operated, without regard to conflict of law principles.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">13. Contact</h2>
            <p>
              For questions about these Terms, please contact us:
            </p>
            <ul className="list-none pl-0 mt-4">
              <li><strong>Email:</strong> legal@circuitsnips.mikeayles.com</li>
              <li><strong>GitHub Issues:</strong> <a href="https://github.com/MichaelAyles/kicad-library/issues" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">github.com/MichaelAyles/kicad-library</a></li>
            </ul>
          </section>

          <section className="mb-8 bg-muted/30 p-6 rounded-lg">
            <h2 className="text-2xl font-semibold mb-4">14. Open Source Notice</h2>
            <p>
              CircuitSnips is open-source software. The platform code is available under the MIT License at:
            </p>
            <p className="mt-2">
              <a href="https://github.com/MichaelAyles/kicad-library" className="text-primary hover:underline font-mono" target="_blank" rel="noopener noreferrer">
                https://github.com/MichaelAyles/kicad-library
              </a>
            </p>
            <p className="mt-4">
              We welcome contributions, bug reports, and feature requests from the community!
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
