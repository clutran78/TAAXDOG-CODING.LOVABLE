// components/NetIncomeModal.tsx
import { Transaction } from "@/lib/types/transactions";
import { Modal } from "react-bootstrap";

interface NetIncomeModalProps {
    show: boolean;
    handleClose: () => void;
    data: {
        name: string;
        amount: number;
        percentage: number;
        transactions?: Transaction[],

    }
}

const IncomeDetailModal: React.FC<NetIncomeModalProps> = ({
    show,
    handleClose,
    data
}) => {
    return (
        <>

            <Modal show={show} onHide={handleClose} className="modal-lg">

                <div className="modal-header">
                    <h5 className="modal-title" id="net-income-modal-label">
                        <i className="fas fa-money-bill-wave text-success me-2"></i>
                       Income Sources Detail
                    </h5>
                    <button
                        type="button"
                        className="btn-close"
                        onClick={handleClose}
                        aria-label="Close"
                    ></button>
                </div>

                <div className="modal-body">

                    <div className="row mb-4">
                        <div className="col-12">
                            <div className="card bg-light">
                                <div className="card-body">
                                    <div className="d-flex justify-content-between align-items-center">
                                        <h4 className="mb-0">{data.name}</h4>
                                        <h3 className="text-success mb-0" id="modal-net-income-value">
                                            ${data.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </h3>
                                    </div>
                                    <div className="text-muted mt-2">
                                        Percentage of total: {data.percentage.toFixed(1)}%
                                    </div>
                                    <div className="progress mt-3" style={{ height: '6px' }}>
                                        <div
                                            className="progress-bar bg-success"
                                            style={{ width: `${data.percentage}%` }}
                                            role="progressbar"
                                            aria-valuenow={data.percentage}
                                            aria-valuemin={0}
                                            aria-valuemax={100}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* <h5 className="mb-3">Transactions</h5> */}

                    {data.transactions && data.transactions.length > 0 ? (
                        <div className="table-responsive">
                            <table className="table table-striped">
                                <thead>
                                    <tr>
                                        <th>Payer</th>
                                        <th>Date</th>
                                        <th>Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.transactions.map((tx, idx) => (
                                        <tr key={idx}>
                                            <td>{tx.merchant}</td>
                                            <td>{new Date(tx.date).toLocaleDateString()}</td>
                                            <td>${parseFloat(tx.amount).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-muted">No transactions available for this income source.</p>
                    )}

                </div>
                
                <div className="modal-footer">
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={handleClose}
                    >
                        Close
                    </button>
                </div>

            </Modal>
        </>
    );
};

export default IncomeDetailModal;
