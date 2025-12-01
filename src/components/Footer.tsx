import Link from "next/link";
import { Github, Mail } from "lucide-react";

export function Footer() {
  return (
    <footer className="py-8 px-4 border-t mt-auto bg-muted/20">
      <div className="container mx-auto max-w-6xl">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center flex-wrap justify-center md:justify-start gap-x-6 gap-y-2">
            <Link
              href="/about"
              className="hover:text-primary transition-colors"
            >
              About
            </Link>
            <Link href="/docs" className="hover:text-primary transition-colors">
              Documentation
            </Link>
            <Link
              href="/privacy"
              className="hover:text-primary transition-colors"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="hover:text-primary transition-colors"
            >
              Terms
            </Link>
            <a
              href="https://github.com/MichaelAyles/kicad-library"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 hover:text-primary transition-colors"
            >
              <Github className="w-4 h-4" />
              <span>GitHub</span>
            </a>
            <a
              href="mailto:info@circuitsnips.com"
              className="flex items-center gap-2 hover:text-primary transition-colors"
            >
              <Mail className="w-4 h-4" />
              <span>Contact</span>
            </a>
          </div>
          <div className="text-center md:text-right">© 2025 CircuitSnips</div>
        </div>
      </div>
    </footer>
  );
}
