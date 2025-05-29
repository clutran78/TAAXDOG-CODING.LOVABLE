import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  getDocs,
  query,
  where,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { Transaction } from "@/lib/types/transactions";
import { Expense } from "@/lib/types/expenses";
import { showToast } from "./helperFunction";
import { Goal } from "@/lib/types/goal";

export const subscribeToAuthState = (
  onAuthSuccess: (userId: string) => void,
  onAuthFail: () => void
): void => {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      onAuthSuccess(user.uid);
    } else {
      onAuthFail();
    }
  });
};

export const fetchIncomeTransactions = async () => {
  return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        showToast("No authenticated user found.", "danger");
        reject("No authenticated user found.");
        return;
      }

      try {
        const q = query(
          collection(db, "bankTransactions"),
          where("userId", "==", user.uid)
        );
        const snapshot = await getDocs(q);

        const transactions: Transaction[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Transaction[];

        const incomeTransactions = transactions.filter(
          (tx) => parseFloat(tx.amount) > 0
        );

        const incomeTotal = incomeTransactions.reduce(
          (sum, tx) => sum + parseFloat(tx.amount),
          0
        );

        const incomeByCategory: {
          [key: string]: { amount: number; transactions: Transaction[] };
        } = {};

        incomeTransactions.forEach((tx) => {
          const category = tx.category || "Other Income";
          if (!incomeByCategory[category]) {
            incomeByCategory[category] = { amount: 0, transactions: [] };
          }
          incomeByCategory[category].amount += parseFloat(tx.amount);
          incomeByCategory[category].transactions.push(tx);
        });

        const sources = Object.entries(incomeByCategory)
          .map(([name, data]) => ({
            name,
            amount: data.amount,
            percentage: (data.amount / incomeTotal) * 100,
            transactions: data.transactions,
          }))
          .sort((a, b) => b.amount - a.amount);

        resolve({ sources, total: incomeTotal });
      } catch (error) {
        reject(error);
      }
    });
  });
};

export const fetchUserExpenses = async (): Promise<Expense[]> => {
  return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        showToast("No authenticated user found.", "danger");
        reject("No authenticated user found.");
        return;
      }

      try {
        const q = query(
          collection(db, "bankTransactions"),
          where("userId", "==", user.uid)
        );

        const snapshot = await getDocs(q);

        const transactions: Expense[] = snapshot.docs.map(
          (doc) => doc.data() as Expense
        );

        const expenses = transactions.filter((tx) => parseFloat(tx.amount) < 0);

        resolve(expenses);
      } catch (error) {
        reject(error);
      }
    });
  });
};

export const fetchSubscriptions = async (): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        showToast("No authenticated user found.", "danger");

        reject("No authenticated user found.");
        return;
      }

      try {
        const q = query(
          collection(db, "subscriptions"),
          where("userId", "==", user.uid)
        );

        const snapshot = await getDocs(q);

        const subscriptions = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        resolve(subscriptions);
      } catch (error) {
        reject(`Error fetching subscriptions: ${error}`);
      }
    });
  });
};

export const fetchBankTransactions = async (): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        showToast("No authenticated user found.", "danger");
        reject("No authenticated user found.");
        return;
      }

      try {
        const q = query(
          collection(db, "bankTransactions"),
          where("userId", "==", user.uid)
        );

        const snapshot = await getDocs(q);

        const transactions = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        resolve(transactions);
      } catch (error) {
        reject(`Error fetching bank transactions: ${error}`);
      }
    });
  });
};

export const fetchGoals = async (): Promise<Goal[]> => {
  return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        showToast("No authenticated user found.", "danger");
        reject("No authenticated user found.");
        return;
      }

      try {
        const q = query(
          collection(db, "goals"),
          where("userId", "==", user.uid)
        );
        const snapshot = await getDocs(q);

        const goals = snapshot.docs.map(
          (doc) =>
            ({
              id: doc.id,
              ...doc.data(),
            } as Goal)
        );

        resolve(goals);
      } catch (error) {
        reject(`Error fetching goals: ${error}`);
      }
    });
  });
};

export const deleteGoal = async (goalId: string): Promise<void> => {
  await deleteDoc(doc(db, "goals", goalId));
};

export const updateGoalProgress = async (
  goalId: string,
  newAmount: number
): Promise<void> => {
  try {
    await updateDoc(doc(db, "goals", goalId), {
      currentAmount: newAmount,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error updating goal progress:", error);
    throw new Error("Failed to update goal progress.");
  }
};

export const fetchTaxProfile = async (userId: string): Promise<any> => {
  try {
    const q = query(
      collection(db, "taxProfiles"),
      where("userId", "==", userId)
    );
    const profileSnap = await getDocs(q);

    if (!profileSnap.empty) {
      return profileSnap.docs[0].data();
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error fetching tax profile:", error);
    throw error;
  }
};

export const fetchReceiptStats = async (userId: string): Promise<any> => {
  try {
    const q = query(
      collection(db, "receiptStats"),
      where("userId", "==", userId)
    );
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      return snapshot.docs[0].data();
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error fetching receipt stats:", error);
    throw error;
  }
};
