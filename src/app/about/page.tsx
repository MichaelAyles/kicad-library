import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { ExternalLink, Github, Mail, Scale, Shield, Users, Zap } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      <main className="flex-1 py-12 px-4">
        <div className="container mx-auto max-w-4xl">
          <h1 className="text-4xl font-bold mb-8">About CircuitSnips</h1>

          {/* Mission Section */}
          <div className="bg-card border rounded-lg p-6 mb-8">
            <div className="flex items-start gap-4">
              <Zap className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
              <div>
                <h2 className="text-2xl font-semibold mb-3">Our Mission</h2>
                <p className="text-muted-foreground mb-4">
                  CircuitSnips bridges the gap between component libraries and full project repositories.
                  We focus on <strong>reusable subcircuits</strong> - functional circuit blocks like voltage
                  regulators, amplifiers, and sensor interfaces that you can instantly copy and paste into
                  your KiCad projects.
                </p>
                <p className="text-muted-foreground">
                  By sharing well-designed, tested circuit patterns, we accelerate innovation in open hardware
                  and help makers avoid reinventing the wheel.
                </p>
              </div>
            </div>
          </div>

          {/* Technology Section with KiCanvas Attribution */}
          <div className="bg-card border rounded-lg p-6 mb-8">
            <div className="flex items-start gap-4">
              <Github className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
              <div>
                <h2 className="text-2xl font-semibold mb-3">Technology & Attribution</h2>
                <p className="text-muted-foreground mb-4">
                  CircuitSnips is built on the shoulders of giants in the open source community:
                </p>

                {/* Special KiCanvas Attribution */}
                <div className="bg-primary/5 border border-primary/20 rounded-md p-4 mb-4">
                  <h3 className="font-semibold mb-2">🎨 KiCanvas</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    Special thanks to <strong>Stargirl Flowers</strong> for creating{' '}
                    <a
                      href="https://github.com/theacodes/kicanvas"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1"
                    >
                      KiCanvas
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    , the incredible WebGL-based schematic viewer that powers our circuit previews.
                    KiCanvas makes it possible to interactively view KiCad schematics directly in the browser.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    CircuitSnips uses a{' '}
                    <a
                      href="https://github.com/MichaelAyles/kicanvas"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1"
                    >
                      fork of KiCanvas
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    {' '}with modifications to integrate seamlessly with our platform and support additional features.
                  </p>
                </div>

                <div className="space-y-2 text-muted-foreground">
                  <p><strong>Stack:</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>Next.js 14 with App Router</li>
                    <li>Supabase (PostgreSQL, Auth, Storage)</li>
                    <li>KiCanvas for schematic rendering</li>
                    <li>Tailwind CSS + shadcn/ui</li>
                    <li>Vercel for deployment</li>
                  </ul>
                </div>

                <p className="text-muted-foreground mt-4">
                  Our source code is available on{' '}
                  <a
                    href="https://github.com/MichaelAyles/kicad-library"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    GitHub
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  {' '}under the MIT license.
                </p>
              </div>
            </div>
          </div>

          {/* Open Hardware Licenses Section */}
          <div className="bg-card border rounded-lg p-6 mb-8">
            <div className="flex items-start gap-4">
              <Scale className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
              <div>
                <h2 className="text-2xl font-semibold mb-3">Open Hardware License Guide</h2>
                <p className="text-muted-foreground mb-4">
                  All circuits on CircuitSnips must use an open source license. Here&apos;s what each means:
                </p>

                <div className="space-y-4">
                  {/* CERN OHL */}
                  <div className="border-l-4 border-primary pl-4">
                    <h3 className="font-semibold text-primary">CERN-OHL-S-2.0 (Recommended)</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      <strong>Best for:</strong> Hardware designs requiring reciprocal sharing
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      The &quot;strongly reciprocal&quot; variant. Modifications must be shared under the same license.
                      Designed specifically for open hardware by CERN. Similar to GPL but for hardware.
                    </p>
                  </div>

                  {/* MIT */}
                  <div className="border-l-4 border-muted pl-4">
                    <h3 className="font-semibold">MIT License</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      <strong>Best for:</strong> Maximum flexibility and adoption
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Very permissive. Allows commercial use, modification, and distribution with minimal
                      restrictions. Only requires attribution.
                    </p>
                  </div>

                  {/* CC-BY */}
                  <div className="border-l-4 border-muted pl-4">
                    <h3 className="font-semibold">CC-BY-4.0</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      <strong>Best for:</strong> Documentation and non-software designs
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Creative Commons Attribution. Allows any use with attribution. Good for schematics
                      as documentation rather than source files.
                    </p>
                  </div>

                  {/* CC-BY-SA */}
                  <div className="border-l-4 border-muted pl-4">
                    <h3 className="font-semibold">CC-BY-SA-4.0</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      <strong>Best for:</strong> Community-driven projects
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Share-Alike variant. Modifications must use the same license. Popular for
                      collaborative hardware projects.
                    </p>
                  </div>

                  {/* GPL */}
                  <div className="border-l-4 border-muted pl-4">
                    <h3 className="font-semibold">GPL-3.0</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      <strong>Best for:</strong> Software-heavy designs (firmware included)
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Strong copyleft. Any derivative work must also be GPL. Good when circuits
                      include significant firmware/software components.
                    </p>
                  </div>

                  {/* Apache */}
                  <div className="border-l-4 border-muted pl-4">
                    <h3 className="font-semibold">Apache-2.0</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      <strong>Best for:</strong> Commercial-friendly with patent protection
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Similar to MIT but includes explicit patent grants. Protects users from
                      patent litigation.
                    </p>
                  </div>

                  {/* TAPR */}
                  <div className="border-l-4 border-muted pl-4">
                    <h3 className="font-semibold">TAPR-OHL-1.0</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      <strong>Best for:</strong> Amateur radio and hobbyist projects
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Created by Tucson Amateur Packet Radio. Similar to GPL but designed for hardware.
                      Less common than CERN-OHL.
                    </p>
                  </div>

                  {/* BSD */}
                  <div className="border-l-4 border-muted pl-4">
                    <h3 className="font-semibold">BSD-2-Clause</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      <strong>Best for:</strong> Academic and research projects
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Simple and permissive like MIT. Often used in academic settings. Allows
                      proprietary derivatives.
                    </p>
                  </div>
                </div>

                <div className="bg-muted/50 rounded-md p-3 mt-4">
                  <p className="text-sm text-muted-foreground">
                    <strong>💡 Tip:</strong> If unsure, CERN-OHL-S-2.0 is designed specifically for
                    open hardware and provides good protection while ensuring designs stay open.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Community Section */}
          <div className="bg-card border rounded-lg p-6 mb-8">
            <div className="flex items-start gap-4">
              <Users className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
              <div>
                <h2 className="text-2xl font-semibold mb-3">Join the Community</h2>
                <p className="text-muted-foreground mb-4">
                  CircuitSnips is more than a tool - it&apos;s a community of makers helping makers.
                </p>
                <div className="flex flex-wrap gap-3">
                  <a
                    href="https://github.com/MichaelAyles/kicad-library/discussions"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 border rounded-md hover:bg-muted transition-colors inline-flex items-center gap-2"
                  >
                    <Github className="w-4 h-4" />
                    Discussions
                  </a>
                  <a
                    href="https://github.com/MichaelAyles/kicad-library/issues"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 border rounded-md hover:bg-muted transition-colors inline-flex items-center gap-2"
                  >
                    <Shield className="w-4 h-4" />
                    Report Issues
                  </a>
                  <a
                    href="mailto:info@circuitsnips.com"
                    className="px-4 py-2 border rounded-md hover:bg-muted transition-colors inline-flex items-center gap-2"
                  >
                    <Mail className="w-4 h-4" />
                    Contact Us
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-6">
            <h3 className="font-semibold mb-2">Ready to share your circuits?</h3>
            <p className="text-muted-foreground mb-4">
              Join CircuitSnips and help build the world&apos;s best library of reusable KiCad circuits.
            </p>
            <div className="flex gap-3">
              <Link
                href="/signup"
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors"
              >
                Sign Up with GitHub
              </Link>
              <Link
                href="/browse"
                className="px-4 py-2 border border-primary text-primary rounded-md font-medium hover:bg-primary/10 transition-colors"
              >
                Browse Circuits
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}