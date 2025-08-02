import React from 'react';

interface Props {
  goToNextTab: (fromId: string, toId: string) => void;
}

const OffsetTabContent: React.FC<Props> = ({ goToNextTab }) => (
  <div
    className="tab-pane fade"
    id="medicare-content"
    role="tabpanel"
  >
    <div className="alert alert-info">
      <i className="fas fa-info-circle me-2"></i>
      This section will contain Medicare levy information and private health insurance details.
    </div>

    <div className="d-flex justify-content-between mt-4">
      <button
        type="button"
        className="btn btn-outline-secondary"
        onClick={() => goToNextTab('medicare-tab', 'offsets-tab')}
      >
        <i className="fas fa-arrow-left me-2"></i> Previous: Tax Offsets
      </button>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => goToNextTab('medicare-tab', 'hecs-tab')}
      >
        Next: HELP/HECS <i className="fas fa-arrow-right ms-2"></i>
      </button>
    </div>
  </div>
);

export default OffsetTabContent;
