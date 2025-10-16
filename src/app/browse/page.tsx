import Link from "next/link";
import { Search, Filter } from "lucide-react";
import { knockSensorCircuit } from "@/lib/knock-sensor-data";

// This will be replaced with real data from database
const mockSubcircuits = [
  // Real circuit: Knock sensor
  {
    ...knockSensorCircuit,
    description: knockSensorCircuit.description.substring(0, 120) + "...",
  },
  {
    id: "2",
    slug: "lm358-opamp-amplifier",
    title: "LM358 Non-Inverting Amplifier",
    description: "Dual op-amp based amplifier circuit with gain of 10. Includes input/output capacitors.",
    user: { username: "johndoe", avatarUrl: null },
    copyCount: 47,
    favoriteCount: 12,
    tags: ["opamp", "amplifier", "analog"],
    category: "Amplifier",
    license: "CERN-OHL-S-2.0",
    createdAt: new Date("2024-01-15"),
  },
  {
    id: "3",
    slug: "lm7805-voltage-regulator",
    title: "LM7805 5V Linear Regulator",
    description: "Classic 7805 voltage regulator with input/output capacitors. Handles up to 1.5A.",
    user: { username: "pradeep", avatarUrl: null },
    copyCount: 89,
    favoriteCount: 24,
    tags: ["power", "regulator", "linear"],
    category: "Power Supply",
    license: "MIT",
    createdAt: new Date("2024-01-10"),
  },
  {
    id: "4",
    slug: "esp32-programming-header",
    title: "ESP32 Programming Header",
    description: "Standard 6-pin programming header for ESP32 modules with auto-reset circuit.",
    user: { username: "sarah", avatarUrl: null },
    copyCount: 156,
    favoriteCount: 45,
    tags: ["esp32", "programming", "microcontroller"],
    category: "Interface",
    license: "CC-BY-4.0",
    createdAt: new Date("2024-01-08"),
  },
  {
    id: "5",
    slug: "usb-c-power-delivery",
    title: "USB-C Power Delivery Circuit",
    description: "USB-C connector with power delivery negotiation. Supports 5V, 9V, and 12V.",
    user: { username: "emily", avatarUrl: null },
    copyCount: 203,
    favoriteCount: 67,
    tags: ["usb-c", "power", "pd"],
    category: "Power Supply",
    license: "CERN-OHL-S-2.0",
    createdAt: new Date("2024-01-05"),
  },
  {
    id: "6",
    slug: "crystal-oscillator-32khz",
    title: "32.768 kHz Crystal Oscillator",
    description: "RTC crystal oscillator circuit with load capacitors. For microcontroller timekeeping.",
    user: { username: "alex", avatarUrl: null },
    copyCount: 78,
    favoriteCount: 18,
    tags: ["crystal", "oscillator", "rtc"],
    category: "Clock",
    license: "MIT",
    createdAt: new Date("2024-01-12"),
  },
];

export default function BrowsePage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-primary">
            CircuitSnips
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/browse" className="text-sm font-medium text-primary">
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

      {/* Main Content */}
      <main className="flex-1">
        <div className="container mx-auto px-4 py-8">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Browse Circuits</h1>
            <p className="text-muted-foreground">
              Discover reusable schematic subcircuits for your KiCad projects
            </p>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col md:flex-row gap-4 mb-8">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <input
                type="text"
                placeholder="Search circuits..."
                className="w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <button className="px-4 py-2 border rounded-md hover:bg-muted/50 transition-colors flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filters
            </button>
          </div>

          {/* Sort Options */}
          <div className="flex items-center gap-4 mb-6 text-sm">
            <span className="text-muted-foreground">Sort by:</span>
            <button className="text-primary font-medium">Most Copied</button>
            <button className="text-muted-foreground hover:text-primary">Recent</button>
            <button className="text-muted-foreground hover:text-primary">Favorites</button>
          </div>

          {/* Subcircuit Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mockSubcircuits.map((circuit) => (
              <Link
                key={circuit.id}
                href={`/circuit/${circuit.slug}`}
                className="bg-card border rounded-lg overflow-hidden hover:shadow-lg transition-shadow group"
              >
                {/* Preview Placeholder */}
                <div className="aspect-video bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-muted/80 transition-colors">
                  <span className="text-sm">Preview Coming Soon</span>
                </div>

                {/* Content */}
                <div className="p-4">
                  <h3 className="font-semibold mb-2 group-hover:text-primary transition-colors">
                    {circuit.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {circuit.description}
                  </p>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {circuit.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 text-xs bg-primary/10 text-primary rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>by @{circuit.user.username}</span>
                    <div className="flex items-center gap-3">
                      <span>📋 {circuit.copyCount}</span>
                      <span>⭐ {circuit.favoriteCount}</span>
                    </div>
                  </div>

                  {/* License Badge */}
                  <div className="mt-3 pt-3 border-t">
                    <span className="text-xs text-muted-foreground">{circuit.license}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Load More */}
          <div className="mt-12 text-center">
            <button className="px-6 py-3 border rounded-md hover:bg-muted/50 transition-colors">
              Load More Circuits
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 px-4 border-t mt-auto bg-muted/20">
        <div className="container mx-auto max-w-6xl text-center text-sm text-muted-foreground">
          <p>Built with ❤️ by the open source hardware community</p>
        </div>
      </footer>
    </div>
  );
}
