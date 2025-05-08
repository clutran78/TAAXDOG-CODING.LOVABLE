"use client";

// import Link from "next/link";
// import { usePathname } from "next/navigation";
// import {
//   FaTachometerAlt,
//   FaMoneyBill,
//   FaChartLine,
//   FaCog,
//   FaSignOutAlt,
//   FaPiggyBank,
//   FaUser,
//   FaReceipt,
//   FaLock,
// } from "react-icons/fa";

// const menuItems = [
//   { label: "Dashboard", icon: <FaTachometerAlt />, path: "/" },
//   { label: "Data Dashboard", icon: <FaChartLine />, path: "/data-dashboard" },
//   { label: "Net Income", icon: <FaMoneyBill />, path: "/net-income" },
//   { label: "Total Expenses", icon: <FaMoneyBill />, path: "/total-expenses" },
//   { label: "Net Balance", icon: <FaChartLine />, path: "/net-balance" },
//   { label: "Subscriptions", icon: <FaPiggyBank />, path: "/subscriptions" },
//   { label: "Bank Accounts", icon: <FaPiggyBank />, path: "/bank-accounts" },
//   { label: "Goals", icon: <FaChartLine />, path: "/goals" },
//   { label: "Your Tax Profile", icon: <FaUser />, path: "/tax-profile" },
//   { label: "Security", icon: <FaLock />, path: "/security" },
//   { label: "Receipt Module", icon: <FaReceipt />, path: "/receipt-module" },
//   { label: "AI Insights", icon: <FaCog />, path: "/ai-insights" },
// ];

export default function Sidebar() {
  // const pathname = usePathname();

  return (
    // <div className="h-screen w-60 bg-white border-r p-5 flex flex-col justify-between">
    //   <div>
    //     <h1 className="text-xl font-bold mb-8">📘 TaaxDog</h1>
    //     <ul className="space-y-3">
    //       {menuItems.map((item) => (
    //         <li key={item.label}>
    //           <Link
    //             href={item.path}
    //             className={`flex items-center space-x-2 px-3 py-2 rounded-md transition hover:bg-gray-100 ${
    //               pathname === item.path ? 'bg-gray-200 font-semibold' : ''
    //             }`}
    //           >
    //             <span>{item.icon}</span>
    //             <span>{item.label}</span>
    //           </Link>
    //         </li>
    //       ))}
    //     </ul>
    //   </div>
    //   <div>
    //     <button className="flex items-center space-x-2 px-3 py-2 text-red-600 hover:bg-red-100 rounded-md">
    //       <FaSignOutAlt />
    //       <span>Log Out</span>
    //     </button>
    //   </div>
    // </div>

    <nav id="sidebar" className="col-md-3 col-lg-2 d-md-block sidebar">
      <div className="sidebar-sticky">
        <ul className="nav flex-column">
          <li className="nav-item">
            <a className="nav-link active" href="#">
              <i className="fas fa-tachometer-alt"></i> Dashboard
            </a>
          </li>
          <li className="nav-item">
            <a className="nav-link" href="#" id="data-dashboard-nav-link">
              <i className="fas fa-chart-bar text-primary"></i> Data Dashboard
            </a>
          </li>
          <li className="nav-item">
            <a className="nav-link" href="#" id="net-income-nav-link">
              <i className="fas fa-money-bill-wave text-success"></i> Net Income
            </a>
          </li>
          <li className="nav-item">
            <a className="nav-link" href="#" id="total-expenses-nav-link">
              <i className="fas fa-arrow-circle-down text-danger"></i> Total
              Expenses
            </a>
          </li>
          <li className="nav-item">
            <a className="nav-link" href="#" id="net-balance-nav-link">
              <i className="fas fa-balance-scale text-primary"></i> Net Balance
            </a>
          </li>
          <li className="nav-item">
            <a className="nav-link" href="#" id="subscriptions-nav-link">
              <i className="fas fa-repeat text-primary"></i> Subscriptions
            </a>
          </li>
          <li className="nav-item">
            <a className="nav-link" href="#" id="bank-accounts-nav-link">
              <i className="fas fa-university text-success"></i> Bank Accounts
            </a>
          </li>
          <li className="nav-item">
            <a className="nav-link" href="#" id="goals-nav-link">
              <i className="fas fa-bullseye me-2"></i> Goals
            </a>
          </li>
          <li className="nav-item">
            <a className="nav-link" href="#" id="tax-profile-nav-link">
              <i className="fas fa-file-invoice-dollar me-2"></i> Your Tax
              Profile
            </a>
          </li>
          <li className="nav-item">
            <a className="nav-link" href="#">
              <i className="fas fa-shield-alt me-2"></i> Security
            </a>
          </li>

          <li className="nav-item">
            <a className="nav-link" href="#" id="receipt-module-nav-link">
              <i className="fas fa-file-invoice text-primary"></i> Receipt
              Module
            </a>
          </li>

          <a
            className="nav-link"
            id="financial-insights-tab"
            data-bs-toggle="pill"
            href="#financial-insights"
            role="tab"
          >
            <i className="fas fa-robot"></i>
            AI Insights
          </a>
        </ul>

        <div className="logout-button mt-auto">
          <ul className="nav flex-column">
            <li className="nav-item">
              <a
                className="nav-link d-flex align-items-center"
                href="#"
                id="logout-button"
              >
                <i className="fas fa-sign-out-alt text-danger me-2"></i>
                <span>Log Out</span>
              </a>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
}
