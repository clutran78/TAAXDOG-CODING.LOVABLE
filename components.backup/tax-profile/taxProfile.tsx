"use client";
import React, { useEffect, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import {
  initializeEmptyTaxProfile,
  populateFormWithProfileData,
  setupTaxProfileForm,
  showToast,
  updateTaxProfileSummary,
} from "@/services/helperFunction";
import {
  fetchTaxProfile,
  subscribeToAuthState,
} from "@/services/firebase-service";
import PersonalInfoTab from "./personal-info-tab";
import IncomeTabContent from "./income-tab-content";
import DeductionsTabContent from "./deductions-tab-content";
import OffsetTabContent from "./offset-tab-content";
import MedicareTabContent from "./medicare-tab-content";
import HelpHECSTabContent from "./help-tab-content";
import AdditionalInfoTabContent from "./additional-info-tab-content";
import { useDarkMode } from "@/providers/dark-mode-provider";

const TAB_IDS = {
  "Personal Information": "personal-tab",
  Income: "income-tab",
  Deductions: "deductions-tab",
  Offsets: "offsets-tab",
  Medicare: "medicare-tab",
  "HELP/HECS": "hecs-tab",
  "Addtional Info": "additional-tab",
};

const TaxProfile: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const { darkMode } = useDarkMode();

  useEffect(() => {
    const handleAuthSuccess = async (userId: string) => {
      try {
        const profileData = await fetchTaxProfile(userId);

        if (!profileData) {
          await initializeEmptyTaxProfile(userId);
        } else {
          populateFormWithProfileData(profileData);
          updateTaxProfileSummary(profileData);
        }

        setupTaxProfileForm();
      } catch (error) {
        console.error("Error loading tax profile:", error);
        showToast(
          "Unable to load tax profile. Please try again later.",
          "danger"
        );
      } finally {
        setLoading(false);
      }
    };

    const handleAuthFail = () => {
      showToast("You must be logged in to access your tax profile.", "warning");
      setLoading(false);
    };

    subscribeToAuthState(handleAuthSuccess, handleAuthFail);
  }, []);

  const goToNextTab = (fromId: string, toId: string) => {
    const fromTab = document.getElementById(fromId);
    const toTab = document.getElementById(toId);
    if (fromTab && toTab) {
      fromTab.classList.remove("active");
      document
        .getElementById(fromTab.getAttribute("data-bs-target")!.substring(1))
        ?.classList.remove("show", "active");

      toTab.classList.add("active");
      document
        .getElementById(toTab.getAttribute("data-bs-target")!.substring(1))
        ?.classList.add("show", "active");
    }
  };

  const NavTabs: React.FC = () => (
    <ul className={`nav nav-tabs mb-4 `} id="taxProfileTabs" role="tablist">
      {Object.entries(TAB_IDS).map(([key, id]) => (
        <li className="nav-item" role="presentation" key={id}>
          <button
            className={`nav-link ${
              id === TAB_IDS["Personal Information"] ? "active" : ""
            } `}
            id={id}
            data-bs-toggle="tab"
            data-bs-target={`#${id.replace("-tab", "-content")}`}
            type="button"
            role="tab"
          >
            {key.replace("_", " ")}
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="container my-4">
      <div className="bg-primary text-white p-3 rounded">
        <h2>
          <i className="fas fa-file-invoice-dollar me-2"></i> Your Tax Profile
        </h2>
      </div>

      <div className="alert alert-info mt-3">
        <i className="fas fa-info-circle me-2"></i>
        Complete your tax profile to help our AI identify potential tax
        deductions and optimize your financial planning.
      </div>

      <form id="tax-profile-form" className="needs-validation" noValidate>
        <NavTabs />

        <div className="tab-content" id="taxProfileTabsContent">
          {/* Personal Info Tab */}
          <PersonalInfoTab goToNextTab={goToNextTab} />

          <IncomeTabContent goToNextTab={goToNextTab} />

          <DeductionsTabContent goToNextTab={goToNextTab} />

          <OffsetTabContent goToNextTab={goToNextTab} />

          <MedicareTabContent goToNextTab={goToNextTab} />

          <HelpHECSTabContent goToNextTab={goToNextTab} />

          <AdditionalInfoTabContent goToNextTab={goToNextTab} />
        </div>
      </form>
    </div>
  );
};

export default TaxProfile;
