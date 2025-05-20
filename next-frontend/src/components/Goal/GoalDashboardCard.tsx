"use client";
import { auth, db } from "@/lib/firebase";
import { Goal } from "./goalPage";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
    }).format(amount);

const GoalsDashboardCard: React.FC<{ onOpenModal: () => void }> = ({ onOpenModal }) => {
    const [goals, setGoals] = useState<Goal[]>([]);
    const [loading, setLoading] = useState(true)
    const router = useRouter()
    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            if (!user) return;

            const q = query(collection(db, "goals"), where("userId", "==", user.uid));
            const unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
                const goalsData: Goal[] = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                })) as Goal[];
                setGoals(goalsData);
            });

            return unsubscribeSnapshot;
        });

        setTimeout(() => {
            setLoading(false)
        }, 2800);
        return () => {
            unsubscribeAuth?.();
        };
    }, []);

    const totalSaved = goals.reduce((sum, g) => sum + g.currentAmount, 0);
    const totalTarget = goals.reduce((sum, g) => sum + g.targetAmount, 0);
    const overallProgress = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;

    const topGoals = [...goals].sort((a, b) => {
        const aProg = a.currentAmount / a.targetAmount;
        const bProg = b.currentAmount / b.targetAmount;
        return bProg - aProg;
    }).slice(0, 3);

    return (
        <div
            className={`card tile-card h-100 ${topGoals.length > 0 ? 'cursor-pointer' : ''}`}
            onClick={() => {
                if (topGoals.length > 0) {
                    onOpenModal();
                }
            }}
            data-tile-type="goals"
            id="goals-card-"
        >
            <div className="card-header">
                <i className="fas fa-bullseye text-warning"></i>
            </div>
            <div className="card-body">
                {goals.length === 0 && loading
                    ?
                    <div className="text-center p-5">
                        <div className="spinner-border text-primary" role="status">
                            <span className="visually-hidden">Loading...</span>
                        </div>
                        <p className="mt-3">Loading Goals data...</p>
                    </div>
                    :
                    <div className="scrollable-content">
                        <h3>{goals.length} Active Goal{goals.length !== 1 ? "s" : ""}</h3>
                        {overallProgress !== 0
                            &&
                            <div className="stat-change positive-change mb-4">
                                <i className="fas fa-check-circle"></i> {overallProgress.toFixed(0)}% Complete
                            </div>
                        }

                        {topGoals.length > 0 ? (
                            topGoals.slice(0, 3).map((goal) => {
                                const progress = (goal.currentAmount / goal.targetAmount) * 100;
                                const due = new Date(goal.dueDate).toLocaleDateString();

                                return (
                                    <div className="goal-item" key={goal.id} >
                                        <div className="goal-details">
                                            <span>{goal.name}</span>
                                            <span className="text-success">{formatCurrency(goal.currentAmount)}</span>
                                        </div>
                                        <div className="progress">
                                            <div
                                                className="progress-bar bg-success"
                                                role="progressbar"
                                                style={{ width: `${progress}%` }}
                                                aria-valuenow={progress}
                                                aria-valuemin={0}
                                                aria-valuemax={100}
                                            ></div>
                                        </div>
                                        <div className="d-flex justify-content-between">
                                            <small>{formatCurrency(goal.currentAmount)} of {formatCurrency(goal.targetAmount)}</small>
                                            <small>Due: {due}</small>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="text-center mt-5">
                                <i className="fas fa-bullseye fa-3x text-muted mb-3"></i>
                                <p
                                    className="text-muted text-center  mt-4"

                                >
                                    {/* <i className="fas fa-bullseye fa-2x text-secondary mb-2 d-block"></i> */}
                                    No goals yet. <span onClick={() => {
                                        router.push("/goals"); // <-- if you're using Next.js or React Router
                                    }} className="text-primary text-decoration-underline cursor-pointer">Click here</span> to add your first financial goal!
                                </p>
                            </div>
                        )}
                    </div>

                }
            </div>
        </div>
    );
};

export default GoalsDashboardCard;
