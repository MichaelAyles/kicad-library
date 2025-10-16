import Link from "next/link";
import { Search as SearchIcon } from "lucide-react";

export default function SearchPage() {
  return (
    <div className="flex flex-col min-h-screen">
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
            <Link href="/search" className="text-sm font-medium text-primary">
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
        <div className="container mx-auto px-4 py-16 max-w-4xl">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">Search Circuits</h1>
            <p className="text-muted-foreground text-lg">
              Find the perfect subcircuit for your project
            </p>
          </div>

          {/* Search Input */}
          <div className="relative mb-8">
            <SearchIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-6 h-6" />
            <input
              type="text"
              placeholder="Search by title, description, components, or tags..."
              className="w-full pl-14 pr-4 py-4 text-lg border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          {/* Quick Filters */}
          <div className="mb-12">
            <h2 className="text-lg font-semibold mb-4">Popular Categories</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                "Power Supply",
                "Amplifier",
                "Microcontroller",
                "Sensor Interface",
                "USB",
                "Display",
                "Motor Control",
                "Audio",
              ].map((category) => (
                <Link
                  key={category}
                  href={`/search?category=${category.toLowerCase().replace(" ", "-")}`}
                  className="px-4 py-3 border rounded-md text-center hover:bg-primary/10 hover:border-primary transition-colors"
                >
                  {category}
                </Link>
              ))}
            </div>
          </div>

          {/* Popular Tags */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Popular Tags</h2>
            <div className="flex flex-wrap gap-2">
              {[
                "opamp",
                "regulator",
                "esp32",
                "arduino",
                "usb-c",
                "buck-converter",
                "crystal",
                "led-driver",
                "sensor",
                "amplifier",
                "power",
                "analog",
                "digital",
                "microcontroller",
              ].map((tag) => (
                <Link
                  key={tag}
                  href={`/search?tag=${tag}`}
                  className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm hover:bg-primary/20 transition-colors"
                >
                  {tag}
                </Link>
              ))}
            </div>
          </div>

          {/* Advanced Search Info */}
          <div className="mt-12 p-6 bg-muted/30 rounded-lg">
            <h3 className="font-semibold mb-2">Search Tips</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Search by component name (e.g., &quot;LM358&quot;, &quot;ESP32&quot;)</li>
              <li>• Search by function (e.g., &quot;voltage regulator&quot;, &quot;amplifier&quot;)</li>
              <li>• Use tags to filter results (e.g., &quot;power&quot;, &quot;usb&quot;)</li>
              <li>• Click categories for common circuit types</li>
            </ul>
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
