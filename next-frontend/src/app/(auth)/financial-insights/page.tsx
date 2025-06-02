"use client";

import { useDarkMode } from "@/providers/dark-mode-provider";
import React, { useEffect } from "react";

const Page = () => {
  const { darkMode } = useDarkMode();
  useEffect(() => {
    // Disable scrolling on mount
    document.body.style.overflow = "hidden";

    // Re-enable scrolling on unmount
    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

  return (
    <div
      className={`d-flex flex-column justify-content-center align-items-center vh-100 ${
        darkMode ? "bg-[#343a40]" : "bg-light"
      } text-center`}
    >
      <i className="fas fa-tools fa-4x text-warning mb-4"></i>
      <h1
        className={`display-5 fw-bold ${
          darkMode ? "text-white" : "text-secondary"
        }`}
      >
        Page Under Development
      </h1>
      <p className={`lead ${darkMode ? "text-secondary" : "text-muted"}`}>
        We&apos;re working hard to bring you this feature. Please check back
        soon!
      </p>
    </div>
  );
};

export default Page;
