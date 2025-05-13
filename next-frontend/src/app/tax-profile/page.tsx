import React from 'react';

const page: React.FC = () => {
  return (
    <div className="d-flex align-items-center justify-content-center vh-100 bg-light">
      <div className="text-center">
        <div className="mb-4">
          <i className="fas fa-tools fa-3x text-warning"></i>
        </div>
        <h2 className="mb-3">Page Under Development</h2>
        <p className="text-muted">We&apos;re working hard to bring this page to life. Please check back soon!</p>
        {/* <button className="btn btn-outline-primary mt-3" onClick={() => window.history.back()}>
          <i className="fas fa-arrow-left me-2"></i>Go Back
        </button> */}
      </div>
    </div>
  );
};

export default page;
