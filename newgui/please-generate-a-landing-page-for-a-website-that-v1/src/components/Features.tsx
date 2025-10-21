
import React from 'react';
import './Features.css';

const Features: React.FC = () => {
  const features = [
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M12 2L14 6H18L15 9L16 14L12 12L8 14L9 9L6 6H10L12 2Z" fill="currentColor"/>
        </svg>
      ),
      title: "KiCad Integration",
      description: "Seamlessly import and export schematic snippets directly with KiCad. No format conversion needed."
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M16 1H4C2.9 1 2 1.9 2 3V17H4V3H16V1ZM19 5H8C6.9 5 6 5.9 6 7V21C6 22.1 6.9 23 8 23H19C20.1 23 21 22.1 21 21V7C21 5.9 20.1 5 19 5ZM19 21H8V7H19V21Z" fill="currentColor"/>
        </svg>
      ),
      title: "Component Library",
      description: "Extensive collection of pre-verified components, from basic resistors to complex microcontrollers."
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M12 2C6.48 2 2 6.48 2 12S6.48 22 12 22 22 17.52 22 12 17.52 2 12 2ZM13 17H11V15H13V17ZM13 13H11V7H13V13Z" fill="currentColor"/>
        </svg>
      ),
      title: "Quality Verified",
      description: "All circuits are reviewed by the community and tested for functionality before being featured."
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M20 6H16L14 4H10L8 6H4C2.9 6 2 6.9 2 8V19C2 20.1 2.9 21 4 21H20C21.1 21 22 20.1 22 19V8C22 6.9 21.1 6 20 6ZM20 19H4V8H20V19ZM13.5 12.5C13.5 11.1 12.4 10 11 10S8.5 11.1 8.5 12.5 9.6 15 11 15 13.5 13.9 13.5 12.5ZM17.5 12.5C17.5 14.1 16.1 15.5 14.5 15.5S11.5 14.1 11.5 12.5 12.9 9.5 14.5 9.5 17.5 10.9 17.5 12.5Z" fill="currentColor"/>
        </svg>
      ),
      title: "Smart Search",
      description: "Find exactly what you need with advanced filtering by component type, voltage, current, and complexity."
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" fill="currentColor"/>
        </svg>
      ),
      title: "Open Source",
      description: "Completely free and open source. Contribute to the community and help others build amazing projects."
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M20 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4ZM20 18H4V8L12 13L20 8V18ZM12 11L4 6H20L12 11Z" fill="currentColor"/>
        </svg>
      ),
      title: "Version Control",
      description: "Track changes, see revision history, and collaborate with others on circuit improvements."
    }
  ];

  return (
    <section id="features" className="features section">
      <div className="container">
        <h2 className="section-title">Why Choose CircuitSnips?</h2>
        <p className="section-subtitle">
          Everything you need to accelerate your electronics design workflow
        </p>
        
        <div className="features-grid">
          {features.map((feature, index) => (
            <div key={index} className="feature-card">
              <div className="feature-icon">
                {feature.icon}
              </div>
              <h3 className="feature-title">{feature.title}</h3>
              <p className="feature-description">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
