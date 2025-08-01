// components/dashboard/net-income.js
'use client';
// import NetBalanceDetailsComponent from '../NetBalance/netBalance';

const NetBalanceDetailsComponent = () => {
  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold">Net Balance Details</h3>
      <p>Net balance details will be displayed here.</p>
    </div>
  );
};

const NetBalanceComponent = () => {
  return (
    <>
      <NetBalanceDetailsComponent />
    </>
  );
};

export default NetBalanceComponent;
