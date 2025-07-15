import React from "react";
import Link from "next/link";

interface BankAccountsCardProps {
  connections: any[];
  connectionLoading: boolean;
  connectionError: string | null;
}

const BankAccountsCard: React.FC<BankAccountsCardProps> = ({
  connections,
  connectionLoading,
  connectionError,
}) => {
  const renderContent = () => {
    if (connectionLoading) {
      return (
        <div className="text-center text-muted py-5">
          <div className="spinner-border text-primary" role="status"></div>
          <p className="mt-3">Loading your bank connections...</p>
        </div>
      );
    }

    if (connectionError) {
      if (
        connectionError.includes("setup-user") ||
        connectionError.includes("Mock users not allowed")
      ) {
        return (
          <div className="text-center text-danger py-4">
            <i className="fas fa-plug fa-3x mb-3 text-muted"></i>
            <p className="mb-2">
              You haven&apos;t set up your bank account connection yet.
            </p>
            <Link href="/connect-bank" className="btn btn-outline-primary">
              Connect Bank
            </Link>
          </div>
        );
      }
      return (
        <div className="alert alert-danger text-center">{connectionError}</div>
      );
    }

    if (connections.length === 0) {
      return (
        <div className="text-center py-4">
          <i className="fas fa-university fa-3x mb-3 text-muted"></i>
          <p>You haven&apos;t connected your bank yet.</p>
          <Link href="/connect-bank" className="btn btn-primary">
            Connect Bank
          </Link>
        </div>
      );
    }

    return (
      <div className="row">
        {connections.map((conn: any) => (
          <div className="col-lg-6 mb-4" key={conn.id}>
            <Link
              href={`/connect-bank`}
              style={{ textDecoration: "none", color: "black" }}
            >
              <div className="border rounded shadow-sm p-3 h-100 bg-light">
                <h6 className="mb-1 text-dark">
                  {conn.name || "Unnamed Account"}
                </h6>
                <p className="mb-1">
                  <strong>Institution:</strong> {conn.institution || "Unknown"}
                </p>
                <p className="mb-1">
                  <strong>Account Holder:</strong> {conn.accountHolder || "N/A"}
                </p>
                <p className="mb-1">
                  <strong>Account Number:</strong> {conn.accountNo || "—"}
                </p>
                <p className="mb-1">
                  <strong>Balance:</strong>{" "}
                  {conn.balance ? `AUD $${conn.balance}` : "—"}
                </p>
                <p className="mb-0">
                  <strong>Connection ID:</strong> <code>{conn.id}</code>
                </p>
              </div>
            </Link>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div
      className="card tile-card mb-3"
      data-tile-type="bank-accounts"
      style={{ height: "calc(50% - 10px)" }}
    >
      <div className="card-header">
        <i className="fas fa-university text-primary"></i> Bank Accounts
      </div>
      <div className="card shadow-sm">
        <div className="card-header border-bottom">
          <h5 className="mb-0">Bank Connections</h5>
        </div>
        <div className="card-body">{renderContent()}</div>
      </div>
    </div>
  );
};

export default BankAccountsCard;
