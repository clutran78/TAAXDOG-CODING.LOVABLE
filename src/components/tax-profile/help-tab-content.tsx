import React from 'react';

interface Props {
  goToNextTab: (fromId: string, toId: string) => void;
}

const HelpHECSTabContent: React.FC<Props> = ({ goToNextTab }) => (
  <div
    className="tab-pane fade"
    id="hecs-content"
    role="tabpanel"
  >
    <div className="alert alert-info">
      <i className="fas fa-info-circle me-2"></i>
      This section will contain HELP/HECS debt information and student loan details.
    </div>

    <div className="d-flex justify-content-between mt-4">
      <button
        type="button"
        className="btn btn-outline-secondary"
        onClick={() => goToNextTab('hecs-tab', 'medicare-tab')}
      >
        <i className="fas fa-arrow-left me-2"></i> Previous: Medicare
      </button>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => goToNextTab('hecs-tab', 'additional-tab')}
      >
        Next: Additional Info <i className="fas fa-arrow-right ms-2"></i>
      </button>
    </div>
  </div>
);

export default HelpHECSTabContent;
