
import React from 'react';
import './Hero.css';

const Hero: React.FC = () => {
  return (
    <section className="hero">
      <div className="hero-background">
        <div className="circuit-pattern"></div>
        <div className="gradient-overlay"></div>
      </div>
      
      <div className="container">
        <div className="hero-content">
          <div className="hero-text">
            <h1 className="hero-title">
              The <span className="highlight">Open Source</span><br />
              Electronics Library
            </h1>
            <p className="hero-subtitle">
              Discover, share, and download KiCad schematic snippets from a thriving community of electronics engineers and makers. Build better circuits faster.
            </p>
            <div className="hero-actions">
              <a href="#browse" className="btn btn-primary">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M21 16V8C21 6.89 20.11 6 19 6H16L14 4H10L8 6H5C3.89 6 3 6.89 3 8V16C3 17.11 3.89 18 5 18H19C20.11 18 21 17.11 21 16Z" fill="currentColor"/>
                </svg>
                Browse Circuits
              </a>
              <a href="#upload" className="btn btn-secondary">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.89 22 5.99 22H18C19.1 22 20 21.1 20 20V8L14 2ZM18 20H6V4H13V9H18V20Z" fill="currentColor"/>
                </svg>
                Upload Your Design
              </a>
            </div>
            <div className="hero-stats">
              <div className="stat">
                <span className="stat-number">25K+</span>
                <span className="stat-label">Circuit Snippets</span>
              </div>
              <div className="stat">
                <span className="stat-number">8.5K</span>
                <span className="stat-label">Contributors</span>
              </div>
              <div className="stat">
                <span className="stat-number">150K+</span>
                <span className="stat-label">Downloads</span>
              </div>
            </div>
          </div>
          
          <div className="hero-visual">
            <div className="pcb-preview">
              <div className="pcb-layer layer-1"></div>
              <div className="pcb-layer layer-2"></div>
              <div className="pcb-layer layer-3"></div>
              <div className="component component-1"></div>
              <div className="component component-2"></div>
              <div className="component component-3"></div>
              <div className="trace trace-1"></div>
              <div className="trace trace-2"></div>
              <div className="trace trace-3"></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
