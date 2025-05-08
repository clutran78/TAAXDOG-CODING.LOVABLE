
export default function Home() {
  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <div className="p-6 grid grid-cols-4 gap-6 bg-gray-50 min-h-screen">

        {/* <!-- Top Metrics --> */}
        <div className="col-span-1 bg-white shadow rounded-lg p-5">
          <h3 className="text-gray-600 font-semibold">Net Income</h3>
          <p className="text-3xl font-bold mt-2">$9575.50</p>
          <p className="text-green-600 mt-1 text-sm">+12.3% from last month</p>
        </div>

        <div className="col-span-1 bg-white shadow rounded-lg p-5">
          <h3 className="text-gray-600 font-semibold">Total Expenses</h3>
          <p className="text-3xl font-bold mt-2">$2843.16</p>
          <p className="text-red-600 mt-1 text-sm">-8.1% from last month</p>
        </div>

        <div className="col-span-1 bg-white shadow rounded-lg p-5">
          <h3 className="text-gray-600 font-semibold">Net Balance</h3>
          <p className="text-3xl font-bold mt-2">$6732.34</p>
          <p className="text-green-600 mt-1 text-sm">+15.2% from last month</p>
        </div>

        <div className="col-span-1 bg-white shadow rounded-lg p-5">
          <h3 className="text-gray-600 font-semibold">Subscriptions</h3>
          <p className="text-3xl font-bold mt-2">$0.00</p>
          <p className="text-gray-400 text-sm">0 active subscriptions</p>
        </div>

        {/* <!-- Goals Progress --> */}
        <div className="col-span-2 bg-white shadow rounded-lg p-5">
          <h3 className="text-lg font-semibold">3 Active Goals</h3>
          <p className="text-sm text-gray-500 mb-4">31.1% Overall Progress</p>

          <div className="mb-4">
            <div className="flex justify-between text-sm">
              <span>New Car</span>
              <span>$2500.00</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
              <div className="bg-green-700 h-2 rounded-full" style={{width:'16.17%'}}></div>
            </div>
            <p className="text-xs text-right text-gray-400 mt-1">Due: 5/7/2026</p>
          </div>

          <div className="mb-4">
            <div className="flex justify-between text-sm">
              <span>Holiday</span>
              <span>$1200.00</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
              <div className="bg-green-700 h-2 rounded-full" style={{width: "40%"}}></div>
            </div>
            <p className="text-xs text-right text-gray-400 mt-1">Due: 9/14/2025</p>
          </div>

          <div>
            <div className="flex justify-between text-sm">
              <span>Emergency Fund</span>
              <span>$5000.00</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
              <div className="bg-green-700 h-2 rounded-full" style={{width: "50%"}}></div>
            </div>
            <p className="text-xs text-right text-gray-400 mt-1">Due: 11/7/2025</p>
          </div>
        </div>

        {/* <!-- Bank Accounts --> */}
        <div className="col-span-1 bg-white shadow rounded-lg p-5">
          <h3 className="text-lg font-semibold mb-2">Bank Accounts</h3>
          <div className="flex items-center gap-3">
            <div className="bg-gray-100 w-10 h-10 rounded-full flex items-center justify-center text-xs">Logo</div>
            <div>
              <p className="font-medium">Commonwealth Bank</p>
              <p className="text-green-500 text-sm">Connected</p>
            </div>
          </div>
        </div>

        {/* <!-- Notifications --> */}
        <div className="col-span-1 bg-white shadow rounded-lg p-5">
          <h3 className="text-lg font-semibold mb-2">2 New Updates</h3>
          <div className="text-sm text-gray-600 space-y-2">
            <div>
              <p className="font-bold">Tax Return Due</p>
              <p>Your tax return is due in 2 weeks</p>
              <p className="text-xs text-gray-400">15/03/2024</p>
            </div>
            <div>
              <p className="font-bold">Goal Milestone</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
