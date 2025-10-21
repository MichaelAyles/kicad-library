
import React from 'react';
import './HowItWorks.css';

const HowItWorks: React.FC = () => {
  const steps = [
    {
      number: "01",
      title: "Browse & Search",
      description: "Explore thousands of circuit snippets or search for specific components and functionalities.",
      icon: (
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M15.5 14H14.71L14.43 13.73C15.41 12.59 16 11.11 16 9.5C16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16C11.11 16 12.59 15.41 13.73 14.43L14 14.71V15.5L19 20.49L20.49 19L15.5 14ZM9.5 14C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14Z" fill="currentColor"/>
        </svg>
      )
    },
    {
      number: "02",
      title: "Download & Import",
      description: "One-click download gets you KiCad-ready files that import seamlessly into your project.",
      icon: (
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M19 9H15V3H9V9H5L12 16L19 9ZM5 18V20H19V18H5Z" fill="currentColor"/>
        </svg>
      )
    },
    {
      number: "03",
      title: "Customize & Build",
      description: "Modify the snippet to fit your needs and integrate it into your larger circuit design.",
      icon: (
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M22.7 19L13.6 9.9C14.5 7.6 14 4.9 12.1 3C10.1 1 7.1 1 5.1 3S1.1 10.1 3.1 12.1C4.9 14 7.6 14.5 9.9 13.6L19 22.7C19.4 23.1 20.1 23.1 20.5 22.7L22.7 20.5C23.1 20.1 23.1 19.4 22.7 19ZM6.2 11C5.5 10.3 5.5 9.2 6.2 8.5S8.3 7.8 9 8.5 9.7 10.6 9 11.3 7.0 11.7 6.2 11Z" fill="currentColor"/>
        </svg>
      )
    },
    {
      number: "04",
      title: "Share Back",
      description: "Contribute your own designs back to the community and help others build better circuits.",
      icon: (
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M18 16.08C17.24 16.08 16.56 16.38 16.04 16.85L8.91 12.7C8.96 12.47 9 12.24 9 12S8.96 11.53 8.91 11.3L15.96 7.19C16.5 7.69 17.21 8 18 8C19.66 8 21 6.66 21 5S19.66 2 18 2 15 3.34 15 5C15 5.24 15.04 5.47 15.09 5.7L8.04 9.81C7.5 9.31 6.79 9 6 9C4.34 9 3 10.34 3 12S4.34 15 6 15C6.79 15 7.5 14.69 8.04 14.19L15.16 18.34C15.11 18.55 15.08 18.77 15.08 19C15.08 20.61 16.39 21.92 18 21.92S20.92 20.61 20.92 19C20.92 17.39 19.61 16.08 18 16.08Z" fill="currentColor"/>
        </svg>
      )
    }
  ];

  return (
    <section id="how-it-works" className="how-it-works section">
      <div className="container">
        <h2 className="section-title">How It Works</h2>
        <p className="section-subtitle">
          Get from idea to prototype in four simple steps
        </p>
        
        <div className="steps-container">
          {steps.map((step, index) => (
            <div key={index} className="step">
              <div className="step-header">
                <div className="step-number">{step.number}</div>
                <div className="step-icon">
                  {step.icon}
                </div>
              </div>
              <div className="step-content">
                <h3 className="step-title">{step.title}</h3>
                <p className="step-description">{step.description}</p>
              </div>
              {index < steps.length - 1 && (
                <div className="step-connector">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M8.59 16.59L13.17 12L8.59 7.41L10 6L16 12L10 18L8.59 16.59Z" fill="currentColor"/>
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
