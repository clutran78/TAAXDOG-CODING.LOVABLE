// components/dashboard/net-income.js
'use client';

import { useEffect, useState } from 'react';
import { loadIncomeDetails } from '@/services/helperFunction.js';
import NetIncomeModal from '@/shared/modals/NetIncomeModal';

const NetComponent = () => {
  const [showNetIncomeModal, setShowNetIncomeModal] = useState(false);

  useEffect(() => {
    if (showNetIncomeModal) {
      // Delay to ensure modal is mounted
      setTimeout(() => {
        loadIncomeDetails();
      }, 0);
    }
  }, [showNetIncomeModal]);

  useEffect(() => {
    setShowNetIncomeModal(true);
  }, []);

  const handleCloseNetIncomeModal = () => {
    setShowNetIncomeModal(false);
  };

  return (
    <>
      {showNetIncomeModal && (
        <NetIncomeModal
          show={true}
          handleClose={handleCloseNetIncomeModal}
        />
      )}
    </>
  );
};

export default NetComponent;
