import { useEffect } from 'react';
import SubscriptionsModal from './ManageSubscriptionsModal';

interface ManageSubscriptionsModalWrapperProps {
  show: boolean;
  handleClose: () => void;
}

const ManageSubscriptionsModalWrapper: React.FC<ManageSubscriptionsModalWrapperProps> = ({ show, handleClose }) => {
  useEffect(() => {
    // When show changes, trigger Bootstrap modal
    const modalElement = document.getElementById('subscriptions-modal');
    if (modalElement) {
      // @ts-ignore - Bootstrap types
      const bsModal = window.bootstrap?.Modal?.getOrCreateInstance(modalElement);
      
      if (show) {
        bsModal?.show();
      } else {
        bsModal?.hide();
      }
      
      // Add event listener for when modal is hidden
      modalElement.addEventListener('hidden.bs.modal', handleClose);
      
      return () => {
        modalElement.removeEventListener('hidden.bs.modal', handleClose);
      };
    }
  }, [show, handleClose]);
  
  return <SubscriptionsModal />;
};

export default ManageSubscriptionsModalWrapper;