// // components/dashboard/net-income.js
// "use client";

// import { useEffect, useState } from 'react';
// import ManageSubscriptionsModal from '@/shared/modals/ManageSubscriptionsModal';

// const SubscriptionComponent = () => {
//     const [showManageSubscriptionsModal, setShowManageSubscriptionsModal] =
//         useState(false);

//     useEffect(() => {
//         setShowManageSubscriptionsModal(true)
//     }, [])

//     const handleCloseManageSubscriptionsModal = () =>
//         setShowManageSubscriptionsModal(false);

//     return (
//         <>
//             {showManageSubscriptionsModal && (
//                 <ManageSubscriptionsModal
//                     show={showManageSubscriptionsModal}
//                     handleClose={handleCloseManageSubscriptionsModal}
//                 />
//             )}
//         </>
//     );
// };

// export default SubscriptionComponent;
