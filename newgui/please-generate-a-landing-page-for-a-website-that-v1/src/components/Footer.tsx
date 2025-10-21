
import React from 'react';
import './Footer.css';

const Footer: React.FC = () => {
  const footerLinks = {
    product: [
      { label: 'Browse Circuits', href: '#browse' },
      { label: 'Upload Design', href: '#upload' },
      { label: 'Search', href: '#search' },
      { label: 'Categories', href: '#categories' }
    ],
    community: [
      { label: 'Discord', href: '#discord' },
      { label: 'GitHub', href: '#github' },
      { label: 'Forum', href: '#forum' },
      { label: 'Contributors', href: '#contributors' }
    ],
    resources: [
      { label: 'Documentation', href: '#docs' },
      { label: 'KiCad Guide', href: '#kicad' },
      { label: 'Tutorials', href: '#tutorials' },
      { label: 'API', href: '#api' }
    ],
    company: [
      { label: 'About', href: '#about' },
      { label: 'Blog', href: '#blog' },
      { label: 'Careers', href: '#careers' },
      { label: 'Contact', href: '#contact' }
    ]
  };

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="footer-logo">
              <div className="logo-icon">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L14 6H18L15 9L16 14L12 12L8 14L9 9L6 6H10L12 2Z" fill="url(#footerGradient)" />
                  <defs>
                    <linearGradient id="footerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#00ff87" />
                      <stop offset="100%" stopColor="#60efff" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <span className="logo-text">CircuitSnips</span>
            </div>
            <p className="footer-description">
              The open source electronics library where engineers share and discover 
              KiCad schematic snippets to accelerate their designs.
            </p>
            <div className="footer-social">
              <a href="#github" className="social-link">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M12 0C5.374 0 0 5.373 0 12C0 17.302 3.438 21.8 8.207 23.387C8.806 23.498 9 23.126 9 22.81V20.576C5.662 21.302 4.967 19.16 4.967 19.16C4.421 17.773 3.634 17.404 3.634 17.404C2.545 16.659 3.717 16.675 3.717 16.675C4.922 16.759 5.556 17.912 5.556 17.912C6.626 19.746 8.363 19.216 9.048 18.909C9.155 18.134 9.466 17.604 9.81 17.305C7.145 17 4.343 15.971 4.343 11.374C4.343 10.063 4.812 8.993 5.579 8.153C5.455 7.85 5.044 6.629 5.696 4.977C5.696 4.977 6.704 4.655 8.997 6.207C9.954 5.941 10.98 5.808 12 5.803C13.02 5.808 14.047 5.941 15.006 6.207C17.297 4.655 18.303 4.977 18.303 4.977C18.956 6.63 18.545 7.851 18.421 8.153C19.191 8.993 19.656 10.064 19.656 11.374C19.656 15.983 16.849 16.998 14.177 17.295C14.607 17.667 15 18.397 15 19.517V22.81C15 23.129 15.192 23.504 15.801 23.386C20.566 21.797 24 17.3 24 12C24 5.373 18.627 0 12 0Z" fill="currentColor"/>
                </svg>
              </a>
              <a href="#discord" className="social-link">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M20.317 4.37C18.787 3.68 17.147 3.19 15.43 2.94C15.204 3.34 14.939 3.86 14.76 4.27C12.936 4.04 11.128 4.04 9.336 4.27C9.157 3.86 8.884 3.34 8.656 2.94C6.936 3.19 5.294 3.68 3.763 4.37C0.542 9.11 -0.331 13.74 0.103 18.3C2.155 19.79 4.142 20.68 6.092 21.25C6.575 20.6 7.009 19.91 7.382 19.18C6.701 18.93 6.056 18.62 5.456 18.26C5.612 18.15 5.765 18.03 5.913 17.91C9.449 19.58 13.313 19.58 16.797 17.91C16.946 18.03 17.099 18.15 17.254 18.26C16.652 18.62 16.007 18.93 15.326 19.18C15.699 19.91 16.133 20.6 16.616 21.25C18.567 20.68 20.555 19.79 22.606 18.3C23.106 13.07 21.773 8.49 20.317 4.37ZM8.019 15.59C6.835 15.59 5.85 14.47 5.85 13.09C5.85 11.71 6.816 10.59 8.019 10.59C9.222 10.59 10.207 11.71 10.188 13.09C10.188 14.47 9.222 15.59 8.019 15.59ZM15.981 15.59C14.797 15.59 13.812 14.47 13.812 13.09C13.812 11.71 14.778 10.59 15.981 10.59C17.184 10.59 18.169 11.71 18.15 13.09C18.15 14.47 17.184 15.59 15.981 15.59Z" fill="currentColor"/>
                </svg>
              </a>
              <a href="#twitter" className="social-link">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M23.953 4.57C23.049 4.98 22.075 5.26 21.057 5.39C22.119 4.78 22.926 3.81 23.302 2.66C22.314 3.23 21.224 3.64 20.077 3.86C19.156 2.9 17.847 2.32 16.407 2.32C13.658 2.32 11.434 4.54 11.434 7.29C11.434 7.69 11.479 8.08 11.565 8.45C7.564 8.25 4.032 6.26 1.64 3.24C1.213 3.94 0.974 4.78 0.974 5.67C0.974 7.35 1.844 8.83 3.162 9.69C2.355 9.66 1.596 9.44 0.934 9.08V9.14C0.934 11.54 2.656 13.54 4.917 13.99C4.501 14.1 4.065 14.16 3.617 14.16C3.299 14.16 2.991 14.13 2.692 14.08C3.316 16.04 5.134 17.46 7.29 17.5C5.583 18.8 3.462 19.57 1.17 19.57C0.78 19.57 0.39 19.55 0 19.5C2.179 20.88 4.767 21.67 7.548 21.67C16.395 21.67 21.295 14.24 21.295 7.88L21.28 7.32C22.272 6.64 23.129 5.78 23.81 4.79L23.953 4.57Z" fill="currentColor"/>
                </svg>
              </a>
            </div>
          </div>
          
          <div className="footer-links">
            <div className="footer-column">
              <h3 className="footer-column-title">Product</h3>
              <ul className="footer-link-list">
                {footerLinks.product.map((link, index) => (
                  <li key={index}>
                    <a href={link.href} className="footer-link">{link.label}</a>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="footer-column">
              <h3 className="footer-column-title">Community</h3>
              <ul className="footer-link-list">
                {footerLinks.community.map((link, index) => (
                  <li key={index}>
                    <a href={link.href} className="footer-link">{link.label}</a>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="footer-column">
              <h3 className="footer-column-title">Resources</h3>
              <ul className="footer-link-list">
                {footerLinks.resources.map((link, index) => (
                  <li key={index}>
                    <a href={link.href} className="footer-link">{link.label}</a>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="footer-column">
              <h3 className="footer-column-title">Company</h3>
              <ul className="footer-link-list">
                {footerLinks.company.map((link, index) => (
                  <li key={index}>
                    <a href={link.href} className="footer-link">{link.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        
        <div className="footer-bottom">
          <div className="footer-bottom-content">
            <p className="footer-copyright">
              © 2024 CircuitSnips. Open source and built with ❤️ by the community.
            </p>
            <div className="footer-bottom-links">
              <a href="#privacy" className="footer-bottom-link">Privacy Policy</a>
              <a href="#terms" className="footer-bottom-link">Terms of Service</a>
              <a href="#license" className="footer-bottom-link">License</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
