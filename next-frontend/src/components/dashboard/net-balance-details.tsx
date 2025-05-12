// components/dashboard/net-income.js
"use client";

import { useEffect, useState } from 'react';
import { openNetBalanceModal } from '@/services/helperFunction';
import NetIncomeModal from '@/shared/modals/NetIncomeModal';
import NetBalanceDetails from '@/shared/modals/NetBalanceDetails';

const NetBalanceComponent = () => {
  const [showNetIncomeModal, setShowNetIncomeModal] = useState(false);

  useEffect(() => {
    if (showNetIncomeModal) {
      // Delay to ensure modal is mounted
      setTimeout(() => {
        openNetBalanceModal();
      }, 0);
    }
  }, [showNetIncomeModal]);

  useEffect(()=>{
    setShowNetIncomeModal(true)
  },[])

  const handleCloseNetIncomeModal = () => {
    setShowNetIncomeModal(false);
  };

  return (
    <>
      {showNetIncomeModal && (
        <NetBalanceDetails show={true} handleClose={handleCloseNetIncomeModal} />
      )}
    </>
  );
};

export default NetBalanceComponent;
