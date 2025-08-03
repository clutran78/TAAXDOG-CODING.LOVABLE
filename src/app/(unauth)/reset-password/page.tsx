import ResetPasswordPage from '@/components/un-auth/resetPassword';
import React, { Suspense } from 'react';

const page = () => {
  return (
    <div>
      <Suspense fallback={<div>Loading...</div>}>
        <ResetPasswordPage />
      </Suspense>
    </div>
  );
};

export default page;
