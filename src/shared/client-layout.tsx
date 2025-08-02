'use client';

import { useState } from 'react';
import Sidebar from '@/components/sidebar';
import Header from '@/shared/Header';
import GlobalWrapper from '@/shared/GlobalWrapper';
import MobileSidebar from '@/components/mobile-sidebar';
import Chatbot from '@/components/chatbot/chatbot';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => !prev);
  };

  return (
    <div className="container-fluid">
      <Header />
      <div className="container-fluid">
        <div className="row">
          <Sidebar
            isCollapsed={isSidebarCollapsed}
            onToggleSidebar={toggleSidebar}
          />
          <MobileSidebar />

          {/* Global Toast Element */}
          <div
            id="main-toast"
            className="toast align-items-center text-white bg-primary border-0 position-fixed top-0 start-50 translate-middle-x mt-3"
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
            style={{ zIndex: 9999, minWidth: '300px' }}
          >
            <div className="d-flex">
              <div
                id="toast-body"
                className="toast-body"
              >
                This is a toast message.
              </div>
              <button
                type="button"
                className="btn-close btn-close-white me-2 m-auto"
                data-bs-dismiss="toast"
                aria-label="Close"
              ></button>
            </div>
          </div>

          {/* <!-- Main Content --> */}
          {/* Main Content */}
          <main
            className={`${
              isSidebarCollapsed
                ? 'col-md-12 col-lg-12 py-2'
                : 'col-md-9 col-lg-10 main-content  ms-sm-auto'
            } px-md-4`}
          >
            <GlobalWrapper>{children}</GlobalWrapper>
          </main>
        </div>
      </div>
    </div>
  );
}
