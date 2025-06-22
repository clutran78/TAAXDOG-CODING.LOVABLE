import React from "react";

interface Props {
  goToNextTab: (fromId: string, toId: string) => void;
}

const MedicareTabContent: React.FC<Props> = ({ goToNextTab }) => (
  <div className="tab-pane fade" id="offsets-content" role="tabpanel">
    <div className="alert alert-info">
      <i className="fas fa-info-circle me-2"></i>
      This section will contain tax offset fields including private health
      insurance details, spouse details for offsets, and other tax offset
      information.
    </div>

    <div className="d-flex justify-content-between mt-4">
      <button
        type="button"
        className="btn btn-outline-secondary"
        onClick={() => goToNextTab("offsets-tab", "deductions-tab")}
      >
        <i className="fas fa-arrow-left me-2"></i> Previous: Deductions
      </button>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => goToNextTab("offsets-tab", "medicare-tab")}
      >
        Next: Medicare <i className="fas fa-arrow-right ms-2"></i>
      </button>
    </div>
  </div>
);

export default MedicareTabContent;
