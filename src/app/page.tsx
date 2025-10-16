import Link from "next/link";
import { Search, Upload, Copy, Zap } from "lucide-react";
import { knockSensorCircuit } from "@/lib/knock-sensor-data";

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-primary">
            CircuitSnips
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/browse" className="text-sm font-medium hover:text-primary transition-colors">
              Browse
            </Link>
            <Link href="/search" className="text-sm font-medium hover:text-primary transition-colors">
              Search
            </Link>
            <Link href="/upload" className="text-sm font-medium hover:text-primary transition-colors">
              Upload
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link
              href="/api/auth/signin"
              className="px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 rounded-md transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4 text-center bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto max-w-4xl">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Copy-Paste Circuits for KiCad
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Share and discover reusable schematic subcircuits. Built by makers, for makers.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/browse"
              className="px-8 py-3 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors inline-flex items-center justify-center gap-2"
            >
              <Search className="w-5 h-5" />
              Browse Library
            </Link>
            <Link
              href="/upload"
              className="px-8 py-3 border border-primary text-primary rounded-md font-medium hover:bg-primary/10 transition-colors inline-flex items-center justify-center gap-2"
            >
              <Upload className="w-5 h-5" />
              Upload Circuit
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Copy className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">1. Copy from KiCad</h3>
              <p className="text-muted-foreground">
                Select your circuit in KiCad and press Ctrl+C. The S-expression goes to your clipboard.
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Upload className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">2. Upload & Share</h3>
              <p className="text-muted-foreground">
                Paste into CircuitSnips, add a description and license. Your circuit is instantly searchable.
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Zap className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">3. One-Click Paste</h3>
              <p className="text-muted-foreground">
                Others find your circuit, click copy, and paste directly into their KiCad projects.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Top Circuits - Placeholder */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold">Top Circuits</h2>
            <Link href="/browse" className="text-sm font-medium text-primary hover:underline">
              View all →
            </Link>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Featured Circuit */}
            <Link
              href={`/circuit/${knockSensorCircuit.slug}`}
              className="bg-card border rounded-lg p-6 hover:shadow-lg transition-shadow"
            >
              <div className="aspect-video bg-gradient-to-br from-blue-50 to-purple-50 rounded-md mb-4 flex items-center justify-center text-primary border-2 border-dashed border-muted">
                <div className="text-center">
                  <p className="text-sm font-medium">{knockSensorCircuit.metadata.stats.componentCount} Components</p>
                  <p className="text-xs text-muted-foreground">Click to view</p>
                </div>
              </div>
              <h3 className="font-semibold mb-2 line-clamp-1">{knockSensorCircuit.title}</h3>
              <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                {knockSensorCircuit.description}
              </p>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>by @{knockSensorCircuit.user.username}</span>
                <span>{knockSensorCircuit.copyCount} copies</span>
              </div>
            </Link>

            {/* Placeholder cards for future circuits */}
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-card border rounded-lg p-6 opacity-50">
                <div className="aspect-video bg-muted rounded-md mb-4 flex items-center justify-center text-muted-foreground text-xs">
                  More circuits coming soon
                </div>
                <h3 className="font-semibold mb-2">Circuit #{i + 1}</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Help us grow the library by uploading your circuits!
                </p>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>by community</span>
                  <span>-</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t mt-auto bg-muted/20">
        <div className="container mx-auto max-w-6xl text-center text-sm text-muted-foreground">
          <p className="mb-2">
            Built with ❤️ by the open source hardware community
          </p>
          <p>
            <Link href="/about" className="hover:text-primary transition-colors">About</Link>
            {" · "}
            <Link href="/docs" className="hover:text-primary transition-colors">Docs</Link>
            {" · "}
            <a href="https://github.com/yourusername/circuitsnips" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
              GitHub
            </a>
            {" · "}
            <span>MIT License</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
