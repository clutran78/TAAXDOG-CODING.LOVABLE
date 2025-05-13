"use client"
import React, { useEffect, useState } from 'react';

interface Goal {
    name: string;
    description?: string;
    currentAmount: number;
    targetAmount: number;
    dueDate: string;
    category?: string;
}

const GoalPage: React.FC = () => {
    const [goals, setGoals] = useState<Goal[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    const [editIndex, setEditIndex] = useState<number | null>(null);
    const [formData, setFormData] = useState<Partial<Goal>>({});
    const [isFormVisible, setIsFormVisible] = useState<boolean>(false);


    useEffect(() => {
        const storedGoals = JSON.parse(localStorage.getItem('financialGoals') || '[]');
        setGoals(storedGoals);
        setLoading(false);
    }, []);

    const formatCurrency = (amount: number): string => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        }).format(amount);
    };

    const totalSaved = goals.reduce((sum, goal) => sum + (goal.currentAmount || 0), 0);
    const totalTarget = goals.reduce((sum, goal) => sum + (goal.targetAmount || 0), 0);
    const overallProgress = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;

    const sortedGoals = [...goals].sort((a, b) => {
        const aProgress = a.targetAmount > 0 ? (a.currentAmount / a.targetAmount) * 100 : 0;
        const bProgress = b.targetAmount > 0 ? (b.currentAmount / b.targetAmount) * 100 : 0;
        return aProgress - bProgress;
    });

    const handleEdit = (index: number) => {
        const goal = goals[index];
        setFormData(goal);
        setEditIndex(index);
        setIsFormVisible(true);
    };

    const handleDelete = (index: number) => {
        const goal = goals[index];
        if (window.confirm(`Are you sure you want to delete the goal "${goal.name}"?`)) {
            const updatedGoals = [...goals];
            updatedGoals.splice(index, 1);
            localStorage.setItem('financialGoals', JSON.stringify(updatedGoals));
            setGoals(updatedGoals);
            alert(`Goal "${goal.name}" deleted successfully.`);
        }
    };

    const handleUpdateProgress = (index: number) => {
        const goal = goals[index];
        const input = prompt(`Enter additional amount to add to "${goal.name}" (current: ${goal.currentAmount}):`, "0");

        if (input === null) return;
        const additional = parseFloat(input);
        if (isNaN(additional) || additional < 0) {
            alert("Please enter a valid positive number.");
            return;
        }

        let updatedAmount = goal.currentAmount + additional;
        if (updatedAmount > goal.targetAmount) {
            if (window.confirm("You've exceeded the target. Cap at target amount?")) {
                updatedAmount = goal.targetAmount;
            }
        }

        const updatedGoals = [...goals];
        updatedGoals[index].currentAmount = updatedAmount;
        localStorage.setItem('financialGoals', JSON.stringify(updatedGoals));
        setGoals(updatedGoals);
        alert(`Added $${additional} to "${goal.name}"`);
    };

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const updatedGoals = [...goals];

        const newGoal: Goal = {
            name: formData.name || '',
            description: formData.description || '',
            currentAmount: parseFloat(formData.currentAmount?.toString() || '0'),
            targetAmount: parseFloat(formData.targetAmount?.toString() || '0'),
            dueDate: formData.dueDate || new Date().toISOString().slice(0, 10)
        };

        if (editIndex !== null) {
            updatedGoals[editIndex] = newGoal;
        } else {
            updatedGoals.push(newGoal);
        }

        localStorage.setItem('financialGoals', JSON.stringify(updatedGoals));
        setGoals(updatedGoals);
        setFormData({});
        setEditIndex(null);
        setIsFormVisible(false);
    };

    return (
        <div className="container py-4">
            <h2 className="mb-4">
                <i className="fas fa-bullseye text-warning me-2"></i>Financial Goals
            </h2>

            {loading ? (
                <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                    <p className="mt-3">Loading your financial goals...</p>
                </div>
            ) : (
                <>
                    {
                        !isFormVisible
                        &&
                        <div>

                            {/* Overall Progress */}
                            <div className="card mb-4">
                                <div className="card-body">
                                    <div className="d-flex justify-content-between align-items-center mb-3">
                                        <h5 className="mb-0">Overall Progress</h5>
                                        <span className="badge bg-primary">{overallProgress.toFixed(1)}%</span>
                                    </div>
                                    <div className="progress mb-3" style={{ height: '15px' }}>
                                        <div className="progress-bar bg-primary" role="progressbar"
                                            style={{ width: `${overallProgress}%` }}
                                            aria-valuenow={overallProgress}
                                            aria-valuemin={0}
                                            aria-valuemax={100}>
                                        </div>
                                    </div>
                                    <div className="d-flex justify-content-between">
                                        <span className="text-muted">Total Saved: {formatCurrency(totalSaved)}</span>
                                        <span className="text-muted">Target: {formatCurrency(totalTarget)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Goals List */}
                            <h5 className="mb-3">Your Active Goals ({goals.length})</h5>

                            {sortedGoals.length === 0 ? (
                                <div className="text-center py-4">
                                    <i className="fas fa-bullseye fa-3x text-muted mb-3"></i>
                                    <p>No financial goals set yet. Click &quot;Add New Goal&quot; to get started!</p>
                                </div>
                            ) : (
                                sortedGoals.map((goal, index) => {
                                    const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
                                    const dueDate = new Date(goal.dueDate).toLocaleDateString();

                                    let progressBarColor = 'bg-success';
                                    if (progress < 25) progressBarColor = 'bg-danger';
                                    else if (progress < 50) progressBarColor = 'bg-warning';
                                    else if (progress < 75) progressBarColor = 'bg-info';

                                    return (
                                        <div className="card mb-3" key={index}>
                                            <div className="card-body">
                                                <div className="d-flex justify-content-between align-items-start mb-3">
                                                    <div>
                                                        <h5 className="mb-1">{goal.name}</h5>
                                                        <span className="text-muted small">
                                                            {goal.description || 'No description'}
                                                        </span>
                                                    </div>
                                                    <div className="text-end">
                                                        <span className={`badge ${progress >= 100 ? 'bg-success' : 'bg-primary'}`}>
                                                            {progress.toFixed(1)}%
                                                        </span>
                                                        <div className="mt-1">
                                                            <button
                                                                className="btn btn-sm btn-outline-primary me-1 "
                                                                onClick={() => handleEdit(index)}
                                                            >
                                                                <i className="fas fa-edit"></i>
                                                            </button>
                                                            <button
                                                                className="btn btn-sm btn-outline-danger"
                                                                onClick={() => handleDelete(index)}
                                                            >
                                                                <i className="fas fa-trash"></i>
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="progress mb-3" style={{ height: '10px' }}>
                                                    <div className={`progress-bar ${progressBarColor}`} role="progressbar"
                                                        style={{ width: `${progress}%` }}
                                                        aria-valuenow={progress}
                                                        aria-valuemin={0}
                                                        aria-valuemax={100}>
                                                    </div>
                                                </div>
                                                <div className="d-flex justify-content-between mb-2">
                                                    <span className="text-muted">Current: {formatCurrency(goal.currentAmount)}</span>
                                                    <span className="text-muted">Target: {formatCurrency(goal.targetAmount)}</span>
                                                </div>
                                                <div className="d-flex justify-content-between">
                                                    <button
                                                        className="btn btn-sm btn-success"
                                                        onClick={() => handleUpdateProgress(index)}
                                                    >
                                                        <i className="fas fa-plus me-1"></i>Update Progress
                                                    </button>
                                                    <span className="text-muted small">Due: {dueDate}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}

                            {/* Tip Section */}
                            <div className="alert alert-light border mt-3">
                                <div className="d-flex">
                                    <div className="me-3">
                                        <i className="fas fa-lightbulb text-warning"></i>
                                    </div>
                                    <div>
                                        <span className="small">
                                            Setting SMART financial goals (Specific, Measurable, Achievable, Relevant, Time-bound)
                                            can increase your chances of success by up to 76% according to research.
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    }
                </>
            )}

          {isFormVisible && (
    <div className="card mt-5 shadow-sm border-0">
        <div className="card-header bg-primary text-white">
            <h5 className="mb-0">{editIndex !== null ? 'Edit Financial Goal' : 'Add New Financial Goal'}</h5>
        </div>
        <form className="card-body" id="add-goal-form" onSubmit={handleFormSubmit}>
            <div className="row">
                <div className="col-md-6 mb-3">
                    <label htmlFor="goal-name" className="form-label">Goal Name</label>
                    <input
                        type="text"
                        className="form-control"
                        id="goal-name"
                        required
                        value={formData.name || ''}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g. New Car"
                    />
                </div>
                <div className="col-md-6 mb-3">
                    <label htmlFor="goal-category" className="form-label">Category</label>
                    <select
                        className="form-select"
                        id="goal-category"
                        required
                        value={formData.category || ''}
                        onChange={e => setFormData({ ...formData, category: e.target.value })}
                    >
                        <option value="">Select category</option>
                        <option value="Emergency Fund">Emergency Fund</option>
                        <option value="Savings">Savings</option>
                        <option value="Debt Payoff">Debt Payoff</option>
                        <option value="Retirement">Retirement</option>
                        <option value="Home">Home</option>
                        <option value="Car">Car</option>
                        <option value="Education">Education</option>
                        <option value="Travel">Travel</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
            </div>

            <div className="mb-3">
                <label htmlFor="goal-description" className="form-label">Description (Optional)</label>
                <textarea
                    className="form-control"
                    id="goal-description"
                    rows={2}
                    value={formData.description || ''}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief details about this goal..."
                />
            </div>

            <div className="row">
                <div className="col-md-6 mb-3">
                    <label htmlFor="goal-current-amount" className="form-label">Current Amount ($)</label>
                    <input
                        type="number"
                        className="form-control"
                        id="goal-current-amount"
                        min="0"
                        step="0.01"
                        required
                        value={formData.currentAmount ?? ''}
                        onChange={e => setFormData({ ...formData, currentAmount: parseFloat(e.target.value) })}
                        placeholder="e.g. 500"
                    />
                </div>
                <div className="col-md-6 mb-3">
                    <label htmlFor="goal-target-amount" className="form-label">Target Amount ($)</label>
                    <input
                        type="number"
                        className="form-control"
                        id="goal-target-amount"
                        min="0"
                        step="0.01"
                        required
                        value={formData.targetAmount ?? ''}
                        onChange={e => setFormData({ ...formData, targetAmount: parseFloat(e.target.value) })}
                        placeholder="e.g. 10000"
                    />
                </div>
            </div>

            <div className="mb-4">
                <label htmlFor="goal-due-date" className="form-label">Due Date</label>
                <input
                    type="date"
                    className="form-control"
                    id="goal-due-date"
                    required
                    value={formData.dueDate || ''}
                    onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
                />
            </div>

            <div className="d-flex justify-content-end">
                <button
                    type="button"
                    className="btn btn-outline-secondary me-2"
                    id="cancel-goal-btn"
                    onClick={() => {
                        setIsFormVisible(false);
                        setFormData({});
                        setEditIndex(null);
                    }}
                >
                    Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                    {editIndex !== null ? 'Update Goal' : 'Save Goal'}
                </button>
            </div>
        </form>
    </div>
)}

        </div>
    );

};

export default GoalPage;
