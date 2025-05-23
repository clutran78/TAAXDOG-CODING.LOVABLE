"use client";
import React, { useEffect } from "react";
import { setupBankConnectionHandlers } from "@/services/helperFunction";
import { useRouter } from "next/navigation";
import { logout } from "./signOut";

const Header = () => {
  const router = useRouter();
  useEffect(() => {
    setupBankConnectionHandlers()

    // @ts-expect-error
    import("bootstrap/dist/js/bootstrap.bundle.min")
      .then(() => console.log("Bootstrap loaded"))
      .catch((err) => console.error("Bootstrap failed to load", err));
  }, []);

  const handleProfileClick = () => {
    router.push("/my-profile");
  };

  return (
    <>
      <nav className="navbar navbar-expand-lg navbar-light sticky-top">
        <div className="container-fluid">
          <a className="navbar-brand" href="#">
            <i className="fas fa-wallet"></i> TaaxDog
          </a>
          <div className="dropdown">
            <i
              className="fas fa-user-circle fa-2x"
              id="profileDropdown"
              data-bs-toggle="dropdown"
              aria-expanded="false"
              style={{ cursor: "pointer" }}
            ></i>
            <ul className="dropdown-menu dropdown-menu-end" aria-labelledby="profileDropdown">
              <li>
                <button className="dropdown-item" onClick={handleProfileClick}>
                  Profile
                </button>
              </li>
              <li>
                <button className="dropdown-item" onClick={logout}>
                  Logout
                </button>
              </li>
            </ul>
          </div>
        </div>
      </nav>
    </>
  );
};

export default Header;
