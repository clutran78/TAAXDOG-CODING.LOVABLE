// components/dashboard/net-income.js
'use client';

import { useEffect, useState } from 'react';
import { loadIncomeDetails, openDetailedExpensesModal } from '@/lib/utils/helpers';
import NetIncomeModal from '@/shared/modals/NetIncomeModal';
import ExpenseCategoriesModal from '@/shared/modals/ExpenseCategoriesModal';
import NetBalanceDetails from '@/shared/modals/NetBalanceDetailsModal';

const TotalExpensesComponent = () => {
  const [showNetIncomeModal, setShowNetIncomeModal] = useState(false);

  useEffect(() => {
    if (showNetIncomeModal) {
      // Delay to ensure modal is mounted
      setTimeout(() => {
        openDetailedExpensesModal();
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
        <NetBalanceDetails
          show={true}
          handleClose={handleCloseNetIncomeModal}
        />
      )}
    </>
  );
};

export default TotalExpensesComponent;
