
import React from 'react';
import './CTA.css';

const CTA: React.FC = () => {
  return (
    <section className="cta section">
      <div className="container">
        <div className="cta-content">
          <div className="cta-background">
            <div className="cta-pattern"></div>
            <div className="cta-glow"></div>
          </div>
          
          <div className="cta-text">
            <h2 className="cta-title">
              Ready to Build Something Amazing?
            </h2>
            <p className="cta-subtitle">
              Join thousands of engineers who are already accelerating their designs with CircuitSnips. 
              Start browsing our library or contribute your own circuits today.
            </p>
          </div>
          
          <div className="cta-actions">
            <a href="#browse" className="btn btn-primary btn-large">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M19 9H15V3H9V9H5L12 16L19 9ZM5 18V20H19V18H5Z" fill="currentColor"/>
              </svg>
              Browse Circuits
            </a>
            <a href="#upload" className="btn btn-secondary btn-large">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.89 22 5.99 22H18C19.1 22 20 21.1 20 20V8L14 2ZM18 20H6V4H13V9H18V20Z" fill="currentColor"/>
              </svg>
              Upload Design
            </a>
          </div>
          
          <div className="cta-features">
            <div className="cta-feature">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>Always Free</span>
            </div>
            <div className="cta-feature">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2"/>
                <path d="M8 12L10.5 14.5L16 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>Quality Verified</span>
            </div>
            <div className="cta-feature">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M16 21V5C16 3.89543 15.1046 3 14 3H6C4.89543 3 4 3.89543 4 5V21L10 17L16 21Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>KiCad Ready</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTA;
