"use client";
import { useState, useEffect } from "react";
import { Modal, Button, Spinner } from "react-bootstrap";
import NetIncomeModal from "./NetIncomeModal";

interface ExpenseCategoriesProps {
  show: boolean;
  handleClose: () => void;
}

const ExpenseCategoriesModal: React.FC<ExpenseCategoriesProps> = ({
  show,
  handleClose,
}) => {
  const [showNetIncomeModal, setShowNetIncomeModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showAllExpenses, setShowAllExpenses] = useState(false); // ✅ added state

  const handleCloseNetIncomeModal = () => setShowNetIncomeModal(false);

  useEffect(() => {
    if (show) {
      setIsLoading(true);
      setShowAllExpenses(false); // ✅ reset view-all state when modal opens
      const timer = setTimeout(() => setIsLoading(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [show]);

  return (
    <>
      <Modal show={show} onHide={handleClose} size="xl" centered>
        <Modal.Header closeButton>
          <Modal.Title id="expense-categories-modal-label">
            <i className="fas fa-chart-pie text-danger me-2"></i>
            Expense Categories
          </Modal.Title>
        </Modal.Header>

        <Modal.Body className="position-relative">
          {isLoading && (
            <div className="position-absolute top-0 start-0 end-0 bottom-0 d-flex flex-column justify-content-center align-items-center spinner-overlay">
              <Spinner animation="border" variant="primary" role="status" />
              <p className="mt-3">Loading expense data...</p>
            </div>
          )}

          <div className="row mb-4">
            <div className="col-12">
              <div className="card bg-light">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-center">
                    <h4 className="mb-0">Total Expenses</h4>
                    <h3 className="text-danger mb-0">$1234.56</h3>
                  </div>
                </div>
              </div>
              {showAllExpenses && (
                <div className="col-12">
                  <div className="input-group">
                    <input
                      type="text"
                      className="form-control"
                      id="expense-search"
                      placeholder="Search expenses..."
                    />
                    <button
                      className="btn btn-primary"
                      type="button"
                      id="expense-search-btn"
                    >
                      <i className="fas fa-search"></i>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          {!showAllExpenses && (
            <>
              <div className="row">
                <div className="col-md-7">
                  <h5 className="mb-3">Expenses by Category</h5>
                  <div className="card">
                    <div className="card-body p-3 max-h-96 overflow-auto">
                      <div className="d-flex justify-content-between align-items-center mb-2 p-2 border-bottom">
                        <div>
                          <span className="badge bg-primary me-2 p-1">
                            Transportation
                          </span>
                          <span>20.3%</span>
                        </div>
                        <span className="text-danger fw-bold">$500.36</span>
                      </div>
                      <div className="d-flex justify-content-between align-items-center mb-2 p-2 border-bottom">
                        <div>
                          <span className="badge bg-primary me-2 p-1">
                            Food
                          </span>
                          <span>15.5%</span>
                        </div>
                        <span className="text-danger fw-bold">$300.00</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-md-5">
                  <h5 className="mb-3">Distribution</h5>
                  <div className="card">
                    <div className="card-body">
                      <div className="text-center py-3">
                        <i className="fas fa-chart-pie fa-3x text-primary mb-3"></i>
                        <p>Chart visualization would appear here</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {showAllExpenses && (
            <div className="view-all">
              <div className="table-responsive">
                <table className="table table-hover">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Description</th>
                      <th>Merchant</th>
                      <th>Category</th>
                      <th>Account</th>
                      <th className="text-end">Amount</th>
                    </tr>
                  </thead>
                  <tbody id="expenses-table-body">
                    <tr>
                      <td>5/8/2025</td>
                      <td>Shopping - Walmart</td>
                      <td>Walmart</td>
                      <td>
                        <span className="badge bg-primary">Shopping</span>
                      </td>
                      <td>Checking Account</td>
                      <td className="text-end text-danger">$36.99</td>
                    </tr>

                    <tr>
                      <td>5/8/2025</td>
                      <td>Gym Membership Subscription</td>
                      <td>Fitness Center</td>
                      <td>
                        <span className="badge bg-primary">
                          Health &amp; Fitness
                        </span>
                      </td>
                      <td>Credit Card</td>
                      <td className="text-end text-danger">$49.99</td>
                    </tr>

                    <tr>
                      <td>5/7/2025</td>
                      <td>Groceries - Kroger</td>
                      <td>Kroger</td>
                      <td>
                        <span className="badge bg-primary">Groceries</span>
                      </td>
                      <td>Credit Card</td>
                      <td className="text-end text-danger">$7.12</td>
                    </tr>

                    <tr>
                      <td>5/7/2025</td>
                      <td>Transportation - Public Transit</td>
                      <td>Public Transit</td>
                      <td>
                        <span className="badge bg-primary">Transportation</span>
                      </td>
                      <td>Checking Account</td>
                      <td className="text-end text-danger">$99.35</td>
                    </tr>

                    <tr>
                      <td>5/6/2025</td>
                      <td>Housing - Home Depot</td>
                      <td>Home Depot</td>
                      <td>
                        <span className="badge bg-primary">Housing</span>
                      </td>
                      <td>Checking Account</td>
                      <td className="text-end text-danger">$30.19</td>
                    </tr>

                    <tr>
                      <td>5/6/2025</td>
                      <td>Cloud Storage Subscription</td>
                      <td>Dropbox</td>
                      <td>
                        <span className="badge bg-primary">Software</span>
                      </td>
                      <td>Credit Card</td>
                      <td className="text-end text-danger">$9.99</td>
                    </tr>

                    <tr>
                      <td>5/5/2025</td>
                      <td>Shopping - Walmart</td>
                      <td>Walmart</td>
                      <td>
                        <span className="badge bg-primary">Shopping</span>
                      </td>
                      <td>Checking Account</td>
                      <td className="text-end text-danger">$51.83</td>
                    </tr>

                    <tr>
                      <td>5/5/2025</td>
                      <td>Utilities - Water Services</td>
                      <td>Water Services</td>
                      <td>
                        <span className="badge bg-primary">Utilities</span>
                      </td>
                      <td>Checking Account</td>
                      <td className="text-end text-danger">$89.24</td>
                    </tr>

                    <tr>
                      <td>5/5/2025</td>
                      <td>Netflix Subscription</td>
                      <td>Netflix</td>
                      <td>
                        <span className="badge bg-primary">Entertainment</span>
                      </td>
                      <td>Credit Card</td>
                      <td className="text-end text-danger">$15.99</td>
                    </tr>

                    <tr>
                      <td>5/5/2025</td>
                      <td>Spotify Subscription</td>
                      <td>Spotify</td>
                      <td>
                        <span className="badge bg-primary">Entertainment</span>
                      </td>
                      <td>Credit Card</td>
                      <td className="text-end text-danger">$9.99</td>
                    </tr>

                    <tr>
                      <td>5/4/2025</td>
                      <td>Groceries - Safeway</td>
                      <td>Safeway</td>
                      <td>
                        <span className="badge bg-primary">Groceries</span>
                      </td>
                      <td>Credit Card</td>
                      <td className="text-end text-danger">$39.88</td>
                    </tr>

                    <tr>
                      <td>5/3/2025</td>
                      <td>Housing - Home Depot</td>
                      <td>Home Depot</td>
                      <td>
                        <span className="badge bg-primary">Housing</span>
                      </td>
                      <td>Checking Account</td>
                      <td className="text-end text-danger">$63.40</td>
                    </tr>

                    <tr>
                      <td>5/2/2025</td>
                      <td>Dining - Starbucks</td>
                      <td>Starbucks</td>
                      <td>
                        <span className="badge bg-primary">Dining</span>
                      </td>
                      <td>Credit Card</td>
                      <td className="text-end text-danger">$80.98</td>
                    </tr>

                    <tr>
                      <td>5/1/2025</td>
                      <td>Entertainment - Spotify</td>
                      <td>Spotify</td>
                      <td>
                        <span className="badge bg-primary">Entertainment</span>
                      </td>
                      <td>Checking Account</td>
                      <td className="text-end text-danger">$17.99</td>
                    </tr>

                    <tr>
                      <td>4/30/2025</td>
                      <td>Utilities - Internet Provider</td>
                      <td>Internet Provider</td>
                      <td>
                        <span className="badge bg-primary">Utilities</span>
                      </td>
                      <td>Credit Card</td>
                      <td className="text-end text-danger">$74.44</td>
                    </tr>

                    <tr>
                      <td>4/29/2025</td>
                      <td>Housing - Apartment Rental</td>
                      <td>Apartment Rental</td>
                      <td>
                        <span className="badge bg-primary">Housing</span>
                      </td>
                      <td>Credit Card</td>
                      <td className="text-end text-danger">$11.24</td>
                    </tr>

                    <tr>
                      <td>4/28/2025</td>
                      <td>Transportation - Uber</td>
                      <td>Uber</td>
                      <td>
                        <span className="badge bg-primary">Transportation</span>
                      </td>
                      <td>Checking Account</td>
                      <td className="text-end text-danger">$16.80</td>
                    </tr>

                    <tr>
                      <td>4/28/2025</td>
                      <td>Dining - Chipotle</td>
                      <td>Chipotle</td>
                      <td>
                        <span className="badge bg-primary">Dining</span>
                      </td>
                      <td>Credit Card</td>
                      <td className="text-end text-danger">$92.16</td>
                    </tr>

                    <tr>
                      <td>4/27/2025</td>
                      <td>Transportation - Public Transit</td>
                      <td>Public Transit</td>
                      <td>
                        <span className="badge bg-primary">Transportation</span>
                      </td>
                      <td>Checking Account</td>
                      <td className="text-end text-danger">$90.88</td>
                    </tr>

                    <tr>
                      <td>4/26/2025</td>
                      <td>Utilities - Phone Company</td>
                      <td>Phone Company</td>
                      <td>
                        <span className="badge bg-primary">Utilities</span>
                      </td>
                      <td>Checking Account</td>
                      <td className="text-end text-danger">$86.32</td>
                    </tr>

                    <tr>
                      <td>4/25/2025</td>
                      <td>Transportation - Shell Gas</td>
                      <td>Shell Gas</td>
                      <td>
                        <span className="badge bg-primary">Transportation</span>
                      </td>
                      <td>Credit Card</td>
                      <td className="text-end text-danger">$37.09</td>
                    </tr>

                    <tr>
                      <td>4/24/2025</td>
                      <td>Entertainment - Apple Music</td>
                      <td>Apple Music</td>
                      <td>
                        <span className="badge bg-primary">Entertainment</span>
                      </td>
                      <td>Checking Account</td>
                      <td className="text-end text-danger">$43.72</td>
                    </tr>

                    <tr>
                      <td>4/23/2025</td>
                      <td>Dining - Chipotle</td>
                      <td>Chipotle</td>
                      <td>
                        <span className="badge bg-primary">Dining</span>
                      </td>
                      <td>Checking Account</td>
                      <td className="text-end text-danger">$63.90</td>
                    </tr>

                    <tr>
                      <td>4/23/2025</td>
                      <td>Utilities - Phone Company</td>
                      <td>Phone Company</td>
                      <td>
                        <span className="badge bg-primary">Utilities</span>
                      </td>
                      <td>Credit Card</td>
                      <td className="text-end text-danger">$56.27</td>
                    </tr>

                    <tr>
                      <td>4/22/2025</td>
                      <td>Transportation - Public Transit</td>
                      <td>Public Transit</td>
                      <td>
                        <span className="badge bg-primary">Transportation</span>
                      </td>
                      <td>Checking Account</td>
                      <td className="text-end text-danger">$85.66</td>
                    </tr>

                    <tr>
                      <td>4/22/2025</td>
                      <td>Groceries - Trader Joe&apos;s</td>
                      <td>Trader Joe&apos;s</td>
                      <td>
                        <span className="badge bg-primary">Groceries</span>
                      </td>
                      <td>Checking Account</td>
                      <td className="text-end text-danger">$46.25</td>
                    </tr>

                    <tr>
                      <td>4/21/2025</td>
                      <td>Housing - IKEA</td>
                      <td>IKEA</td>
                      <td>
                        <span className="badge bg-primary">Housing</span>
                      </td>
                      <td>Checking Account</td>
                      <td className="text-end text-danger">$36.91</td>
                    </tr>

                    <tr>
                      <td>4/21/2025</td>
                      <td>Groceries - Whole Foods</td>
                      <td>Whole Foods</td>
                      <td>
                        <span className="badge bg-primary">Groceries</span>
                      </td>
                      <td>Checking Account</td>
                      <td className="text-end text-danger">$70.84</td>
                    </tr>

                    <tr>
                      <td>4/20/2025</td>
                      <td>Housing - Home Depot</td>
                      <td>Home Depot</td>
                      <td>
                        <span className="badge bg-primary">Housing</span>
                      </td>
                      <td>Checking Account</td>
                      <td className="text-end text-danger">$90.98</td>
                    </tr>

                    <tr>
                      <td>4/19/2025</td>
                      <td>Shopping - Walmart</td>
                      <td>Walmart</td>
                      <td>
                        <span className="badge bg-primary">Shopping</span>
                      </td>
                      <td>Checking Account</td>
                      <td className="text-end text-danger">$50.98</td>
                    </tr>

                    <tr>
                      <td>4/18/2025</td>
                      <td>Housing - Property Management</td>
                      <td>Property Management</td>
                      <td>
                        <span className="badge bg-primary">Housing</span>
                      </td>
                      <td>Credit Card</td>
                      <td className="text-end text-danger">$12.21</td>
                    </tr>

                    <tr>
                      <td>4/17/2025</td>
                      <td>Dining - The Cheesecake Factory</td>
                      <td>The Cheesecake Factory</td>
                      <td>
                        <span className="badge bg-primary">Dining</span>
                      </td>
                      <td>Checking Account</td>
                      <td className="text-end text-danger">$83.12</td>
                    </tr>

                    <tr>
                      <td>4/16/2025</td>
                      <td>Housing - Apartment Rental</td>
                      <td>Apartment Rental</td>
                      <td>
                        <span className="badge bg-primary">Housing</span>
                      </td>
                      <td>Checking Account</td>
                      <td className="text-end text-danger">$97.19</td>
                    </tr>

                    <tr>
                      <td>4/15/2025</td>
                      <td>Transportation - Chevron</td>
                      <td>Chevron</td>
                      <td>
                        <span className="badge bg-primary">Transportation</span>
                      </td>
                      <td>Checking Account</td>
                      <td className="text-end text-danger">$77.90</td>
                    </tr>

                    <tr>
                      <td>4/15/2025</td>
                      <td>Entertainment - Netflix</td>
                      <td>Netflix</td>
                      <td>
                        <span className="badge bg-primary">Entertainment</span>
                      </td>
                      <td>Credit Card</td>
                      <td className="text-end text-danger">$48.07</td>
                    </tr>

                    <tr>
                      <td>4/14/2025</td>
                      <td>Dining - Chipotle</td>
                      <td>Chipotle</td>
                      <td>
                        <span className="badge bg-primary">Dining</span>
                      </td>
                      <td>Checking Account</td>
                      <td className="text-end text-danger">$62.19</td>
                    </tr>

                    <tr>
                      <td>4/13/2025</td>
                      <td>Shopping - Target</td>
                      <td>Target</td>
                      <td>
                        <span className="badge bg-primary">Shopping</span>
                      </td>
                      <td>Credit Card</td>
                      <td className="text-end text-danger">$54.92</td>
                    </tr>

                    <tr>
                      <td>4/12/2025</td>
                      <td>Entertainment - Spotify</td>
                      <td>Spotify</td>
                      <td>
                        <span className="badge bg-primary">Entertainment</span>
                      </td>
                      <td>Checking Account</td>
                      <td className="text-end text-danger">$38.42</td>
                    </tr>

                    <tr>
                      <td>4/12/2025</td>
                      <td>Dining - Starbucks</td>
                      <td>Starbucks</td>
                      <td>
                        <span className="badge bg-primary">Dining</span>
                      </td>
                      <td>Credit Card</td>
                      <td className="text-end text-danger">$87.79</td>
                    </tr>

                    <tr>
                      <td>4/11/2025</td>
                      <td>Healthcare - Pharmacy</td>
                      <td>Pharmacy</td>
                      <td>
                        <span className="badge bg-primary">Healthcare</span>
                      </td>
                      <td>Checking Account</td>
                      <td className="text-end text-danger">$7.25</td>
                    </tr>

                    <tr>
                      <td>4/10/2025</td>
                      <td>Groceries - Whole Foods</td>
                      <td>Whole Foods</td>
                      <td>
                        <span className="badge bg-primary">Groceries</span>
                      </td>
                      <td>Checking Account</td>
                      <td className="text-end text-danger">$72.50</td>
                    </tr>

                    <tr>
                      <td>4/10/2025</td>
                      <td>Transportation - Shell Gas</td>
                      <td>Shell Gas</td>
                      <td>
                        <span className="badge bg-primary">Transportation</span>
                      </td>
                      <td>Credit Card</td>
                      <td className="text-end text-danger">$92.68</td>
                    </tr>

                    <tr>
                      <td>4/9/2025</td>
                      <td>Shopping - Target</td>
                      <td>Target</td>
                      <td>
                        <span className="badge bg-primary">Shopping</span>
                      </td>
                      <td>Checking Account</td>
                      <td className="text-end text-danger">$85.20</td>
                    </tr>

                    <tr>
                      <td>4/9/2025</td>
                      <td>Entertainment - Netflix</td>
                      <td>Netflix</td>
                      <td>
                        <span className="badge bg-primary">Entertainment</span>
                      </td>
                      <td>Checking Account</td>
                      <td className="text-end text-danger">$73.61</td>
                    </tr>

                    <tr>
                      <td>4/9/2025</td>
                      <td>Spotify Subscription</td>
                      <td>Spotify</td>
                      <td>
                        <span className="badge bg-primary">Entertainment</span>
                      </td>
                      <td>Credit Card</td>
                      <td className="text-end text-danger">$9.99</td>
                    </tr>

                    <tr>
                      <td>4/9/2025</td>
                      <td>Cloud Storage Subscription</td>
                      <td>Dropbox</td>
                      <td>
                        <span className="badge bg-primary">Software</span>
                      </td>
                      <td>Credit Card</td>
                      <td className="text-end text-danger">$9.99</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Modal.Body>

        <Modal.Footer>
          {!showAllExpenses && (
            <>
              <Button variant="secondary" onClick={handleClose}>
                Close
              </Button>
              <Button
                variant="primary"
                id="view-all-expenses-btn"
                onClick={() => setShowAllExpenses(true)}
              >
                <i className="fas fa-list-ul me-2"></i>
                View All Expenses
              </Button>
            </>
          )}

          {showAllExpenses && (
            <>
              <Button variant="secondary" onClick={handleClose}>
                Close
              </Button>
              <Button
                variant="primary"
                id="view-all-expenses-btn"
                onClick={() => setShowAllExpenses(false)}
              >
                <i className="fas fa-list-ul me-2"></i>
                <i className="fas fa-chart-pie me-2"></i>View Expense Categories
              </Button>
            </>
          )}
        </Modal.Footer>
      </Modal>

      <NetIncomeModal
        show={showNetIncomeModal}
        handleClose={handleCloseNetIncomeModal}
      />
    </>
  );
};

export default ExpenseCategoriesModal;
