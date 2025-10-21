
import React, { useState } from 'react';
import './Header.css';

const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="header">
      <div className="container">
        <div className="header-content">
          <div className="logo">
            <div className="logo-icon">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L14 6H18L15 9L16 14L12 12L8 14L9 9L6 6H10L12 2Z" fill="url(#gradient)" />
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#00ff87" />
                    <stop offset="100%" stopColor="#60efff" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <span className="logo-text">CircuitSnips</span>
          </div>
          
          <nav className={`nav ${isMenuOpen ? 'nav-open' : ''}`}>
            <a href="#features" className="nav-link">Features</a>
            <a href="#how-it-works" className="nav-link">How it Works</a>
            <a href="#community" className="nav-link">Community</a>
            <a href="#browse" className="nav-link">Browse</a>
          </nav>
          
          <div className="header-actions">
            <a href="#login" className="btn btn-secondary">Sign In</a>
            <a href="#signup" className="btn btn-primary">Get Started</a>
          </div>
          
          <button 
            className="mobile-menu-toggle"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
