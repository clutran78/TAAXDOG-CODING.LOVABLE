"use client";
import React, { useState } from "react";
import ConnectBankModal from "./modals/ConnectBankModal";

const Header = () => {
  const [showBankModal, setShowBankModal] = useState(false);

  const handleShowBankModal = () => setShowBankModal(true);
  const handleCloseBankModal = () => setShowBankModal(false);
  return (
    <>
      <nav className="navbar navbar-expand-lg navbar-light sticky-top">
        <div className="container-fluid">
          <a className="navbar-brand" href="#">
            <i className="fas fa-wallet"></i> TaaxDog
          </a>
          <div className="d-flex">
            <button
              className="connect-bank-btn"
              id="connect-bank-button"
              onClick={handleShowBankModal}
            >
              Connect Bank
            </button>
          </div>
        </div>
      </nav>
      {/* NetIncomeModal component */}
      <ConnectBankModal
        show={showBankModal}
        handleClose={handleCloseBankModal}
      />
    </>
  );
};

export default Header;
