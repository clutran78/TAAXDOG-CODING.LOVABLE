import React from 'react';

interface Props {
  goToNextTab: (fromId: string, toId: string) => void;
}

const AdditionalInfoTabContent: React.FC<Props> = ({ goToNextTab }) => (
  <div
    className="tab-pane fade"
    id="additional-content"
    role="tabpanel"
  >
    <div className="alert alert-info">
      <i className="fas fa-info-circle me-2"></i>
      This section will contain additional tax information such as foreign entities, family trust
      details, and other special circumstances.
    </div>

    <div className="d-flex justify-content-between mt-4">
      <button
        type="button"
        className="btn btn-outline-secondary"
        onClick={() => goToNextTab('additional-tab', 'hecs-tab')}
      >
        <i className="fas fa-arrow-left me-2"></i> Previous: HELP/HECS
      </button>
      <button
        type="button"
        className="btn btn-primary"
        id="save-tax-profile"
        onClick={() => goToNextTab('additional-tab', 'personal-tab')}
      >
        <i className="fas fa-save me-2"></i> Save Tax Profile
      </button>
    </div>
  </div>
);

export default AdditionalInfoTabContent;
