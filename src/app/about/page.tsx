import Link from 'next/link';
import { Header } from '@/components/Header';

export default function AboutPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      <main className="flex-1 py-12 px-4">
        <div className="container mx-auto max-w-3xl">
          <h1 className="text-4xl font-bold mb-6">About CircuitSnips</h1>

          <div className="prose prose-invert dark:prose-invert max-w-none space-y-6 text-foreground">
            <div>
              <h2 className="text-2xl font-semibold mb-3">What is CircuitSnips?</h2>
              <p className="text-muted-foreground">
                CircuitSnips is an open-source platform for sharing and discovering reusable KiCad schematic subcircuits.
                We make it easy for electronics makers to copy-paste useful circuit blocks directly into their KiCad projects.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold mb-3">Our Mission</h2>
              <p className="text-muted-foreground">
                To democratize circuit design by creating a community-driven library of reusable, tested, and well-documented
                subcircuits. We believe that sharing good design patterns accelerates innovation in open hardware.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold mb-3">Technology</h2>
              <p className="text-muted-foreground mb-2">CircuitSnips is built with:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>Next.js 14 for the frontend and API</li>
                <li>Supabase for database, authentication, and storage</li>
                <li>KiCanvas for interactive schematic viewing</li>
                <li>PostgreSQL full-text search</li>
                <li>Tailwind CSS for styling</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-semibold mb-3">Open Source</h2>
              <p className="text-muted-foreground">
                CircuitSnips itself is open source under the MIT license. You can find the source code on{' '}
                <a href="https://github.com/MichaelAyles/kicad-library" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  GitHub
                </a>
                . Contributions are welcome!
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold mb-3">Licensing</h2>
              <p className="text-muted-foreground">
                Circuits uploaded to CircuitSnips must be licensed under an open hardware or open source license.
                We support: CERN-OHL, MIT, CC-BY, GPL, Apache 2.0, and more. All circuits remain the property of
                their creators and are shared under their chosen license terms.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold mb-3">Contact</h2>
              <p className="text-muted-foreground">
                Have questions? Open an issue on{' '}
                <a href="https://github.com/MichaelAyles/kicad-library/issues" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  GitHub
                </a>
                {' '}or reach out to us on social media.
              </p>
            </div>
          </div>

          <div className="mt-12 p-6 bg-primary/10 border border-primary/20 rounded-lg">
            <h3 className="font-semibold mb-2">Ready to share your circuits?</h3>
            <p className="text-muted-foreground mb-4">
              Join the CircuitSnips community and help grow the library of reusable circuits.
            </p>
            <div className="flex gap-3">
              <Link
                href="/signup"
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors"
              >
                Sign Up
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

      <footer className="py-8 px-4 border-t mt-auto bg-muted/20">
        <div className="container mx-auto max-w-6xl text-center text-sm text-muted-foreground">
          <p>Built with ❤️ by the open source hardware community</p>
        </div>
      </footer>
    </div>
  );
}
