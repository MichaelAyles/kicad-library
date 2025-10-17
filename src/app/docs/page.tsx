import Link from 'next/link';
import { Header } from '@/components/Header';

export default function DocsPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      <main className="flex-1 py-12 px-4">
        <div className="container mx-auto max-w-3xl">
          <h1 className="text-4xl font-bold mb-2">Documentation</h1>
          <p className="text-muted-foreground mb-12">Learn how to use CircuitSnips</p>

          <div className="grid gap-6">
            {/* Getting Started */}
            <div className="border rounded-lg p-6 hover:shadow-md transition-shadow">
              <h2 className="text-xl font-semibold mb-2">Getting Started</h2>
              <p className="text-muted-foreground text-sm mb-4">
                New to CircuitSnips? Start here to learn the basics.
              </p>
              <Link href="#" className="text-primary hover:underline text-sm font-medium">
                Read guide →
              </Link>
            </div>

            {/* Uploading Circuits */}
            <div className="border rounded-lg p-6 hover:shadow-md transition-shadow">
              <h2 className="text-xl font-semibold mb-2">Uploading Circuits</h2>
              <p className="text-muted-foreground text-sm mb-4">
                Learn how to upload your KiCad subcircuits to the library.
              </p>
              <Link href="#" className="text-primary hover:underline text-sm font-medium">
                Read guide →
              </Link>
            </div>

            {/* Searching & Browsing */}
            <div className="border rounded-lg p-6 hover:shadow-md transition-shadow">
              <h2 className="text-xl font-semibold mb-2">Searching & Browsing</h2>
              <p className="text-muted-foreground text-sm mb-4">
                Find circuits using search, filters, and advanced queries.
              </p>
              <Link href="#" className="text-primary hover:underline text-sm font-medium">
                Read guide →
              </Link>
            </div>

            {/* Using Circuits in KiCad */}
            <div className="border rounded-lg p-6 hover:shadow-md transition-shadow">
              <h2 className="text-xl font-semibold mb-2">Using Circuits in KiCad</h2>
              <p className="text-muted-foreground text-sm mb-4">
                Copy circuits from CircuitSnips and paste them into your KiCad projects.
              </p>
              <Link href="#" className="text-primary hover:underline text-sm font-medium">
                Read guide →
              </Link>
            </div>

            {/* Attribution & Licensing */}
            <div className="border rounded-lg p-6 hover:shadow-md transition-shadow">
              <h2 className="text-xl font-semibold mb-2">Attribution & Licensing</h2>
              <p className="text-muted-foreground text-sm mb-4">
                Understand how to properly attribute circuits and respect licenses.
              </p>
              <Link href="#" className="text-primary hover:underline text-sm font-medium">
                Read guide →
              </Link>
            </div>

            {/* API Documentation */}
            <div className="border rounded-lg p-6 hover:shadow-md transition-shadow">
              <h2 className="text-xl font-semibold mb-2">API Reference</h2>
              <p className="text-muted-foreground text-sm mb-4">
                Build tools and integrations with our API (coming soon).
              </p>
              <Link href="#" className="text-primary hover:underline text-sm font-medium opacity-50 pointer-events-none">
                Read guide (Coming soon)
              </Link>
            </div>
          </div>

          {/* Quick Links */}
          <div className="mt-12 p-6 bg-muted/30 border rounded-lg">
            <h3 className="font-semibold mb-4">Need help?</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/about" className="text-primary hover:underline">
                  About CircuitSnips
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com/MichaelAyles/kicad-library/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Report an issue on GitHub
                </a>
              </li>
              <li>
                <Link href="/browse" className="text-primary hover:underline">
                  Browse the library
                </Link>
              </li>
            </ul>
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
