
import React from 'react';
import './Community.css';

const Community: React.FC = () => {
  const stats = [
    {
      number: "25,847",
      label: "Circuit Snippets",
      description: "Ready-to-use designs"
    },
    {
      number: "8,523",
      label: "Active Contributors",
      description: "Engineers worldwide"
    },
    {
      number: "152,391",
      label: "Total Downloads",
      description: "This month alone"
    },
    {
      number: "96%",
      label: "Success Rate",
      description: "Working first time"
    }
  ];

  const testimonials = [
    {
      name: "Sarah Chen",
      role: "Hardware Engineer at Tesla",
      avatar: "SC",
      content: "CircuitSnips saved me weeks of design time. The power management snippets are incredibly well-documented."
    },
    {
      name: "Marcus Rodriguez",
      role: "Maker & Educator",
      avatar: "MR",
      content: "My students love how easy it is to find and understand circuit examples. Great for learning electronics!"
    },
    {
      name: "Emily Watson",
      role: "Startup Founder",
      avatar: "EW",
      content: "As a software engineer transitioning to hardware, CircuitSnips made electronics design accessible to me."
    }
  ];

  return (
    <section id="community" className="community section">
      <div className="container">
        <h2 className="section-title">Join the Community</h2>
        <p className="section-subtitle">
          Thousands of engineers are already building better circuits together
        </p>
        
        <div className="stats-grid">
          {stats.map((stat, index) => (
            <div key={index} className="stat-card">
              <div className="stat-number">{stat.number}</div>
              <div className="stat-label">{stat.label}</div>
              <div className="stat-description">{stat.description}</div>
            </div>
          ))}
        </div>
        
        <div className="testimonials">
          <h3 className="testimonials-title">What Engineers Are Saying</h3>
          <div className="testimonials-grid">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="testimonial-card">
                <div className="testimonial-content">
                  <p>"{testimonial.content}"</p>
                </div>
                <div className="testimonial-author">
                  <div className="author-avatar">{testimonial.avatar}</div>
                  <div className="author-info">
                    <div className="author-name">{testimonial.name}</div>
                    <div className="author-role">{testimonial.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Community;
