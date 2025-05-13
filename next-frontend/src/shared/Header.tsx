"use client";
import { setupBankConnectionHandlers } from "@/services/helperFunction";
import React, { useEffect } from "react";

const Header = () => {
  useEffect(() => {
    setupBankConnectionHandlers()

    // @ts-ignore
    import('bootstrap/dist/js/bootstrap.bundle.min')
      .then(() => {
        console.log('Bootstrap loaded');
      })
      .catch((err) => console.error('Bootstrap failed to load', err));
  }, []);
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
            // onClick={handleShowBankModal}
            >
              Connect Bank
            </button>
          </div>
        </div>
      </nav>
      {/* NetIncomeModal component */}
      {/* <ConnectBankModal
        show={showBankModal}
        handleClose={handleCloseBankModal}
      /> */}
    </>
  );
};

export default Header;
