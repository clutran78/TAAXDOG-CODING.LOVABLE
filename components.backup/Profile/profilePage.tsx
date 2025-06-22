"use client";
import React, { useEffect, useState } from "react";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import {
    doc,
    getDoc,
    updateDoc,
} from "firebase/firestore";
import { auth, db, storage } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { showToast } from "@/services/helperFunction";

const validationSchema = Yup.object().shape({
    fullName: Yup.string().required("Full name is required"),
    email: Yup.string().email("Invalid email").required("Email is required"),
    //   phone: Yup.string().required("Phone number is required"),
    address: Yup.string().required("Address is required"),
});

const ProfilePage = () => {
    const [initialValues, setInitialValues] = useState({
        fullName: "",
        email: "",
        // phone: "",
        address: "",
        profileImageUrl: "",
    });
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState("");

    useEffect(() => {
        const fetchUserData = async (uid: string) => {
            const userRef = doc(db, "users", uid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                const data = userSnap.data();
                setInitialValues({
                    fullName: data.fullName || "",
                    email: data.email || "",
                    //   phone: data.phone || "",
                    address: data.address || "",
                    profileImageUrl: data.profileImageUrl || "",
                });
            }
            setLoading(false);
        };

        onAuthStateChanged(auth, (user) => {
            if (user) {
                setUserId(user.uid);
                fetchUserData(user.uid);
            } else {
                setLoading(false);
            }
        });
    }, []);

    const handleSubmit = async (values: any) => {
        if (!userId) return;
        const userRef = doc(db, "users", userId);
        await updateDoc(userRef, {
            fullName: values.fullName,
            email: values.email,
            //   phone: values.phone,
            address: values.address,
        });
        showToast("Profile updated successfully!", 'success');
    };


   return (
  <>
    <div className="container mt-5">
      {loading ? (
        <div className="d-flex justify-content-center align-items-center" style={{ height: "50vh" }}>
          <span className="spinner-border text-primary" role="status" aria-hidden="true"></span>
        </div>
      ) : (
        <>
          <h2 className="mb-4">My Profile</h2>
          <Formik
            initialValues={initialValues}
            enableReinitialize
            validationSchema={validationSchema}
            onSubmit={handleSubmit}
          >
            {({ isSubmitting }) => (
              <Form>
                <div className="mb-3">
                  <label>Full Name</label>
                  <Field name="fullName" type="text" className="form-control" />
                  <ErrorMessage name="fullName" component="div" className="text-danger" />
                </div>

                <div className="mb-3">
                  <label>Email</label>
                  <Field name="email" type="email" className="form-control" />
                  <ErrorMessage name="email" component="div" className="text-danger" />
                </div>

                <div className="mb-3">
                  <label>Address</label>
                  <Field name="address" type="text" className="form-control" />
                  <ErrorMessage name="address" component="div" className="text-danger" />
                </div>

                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </button>
              </Form>
            )}
          </Formik>
        </>
      )}
    </div>
  </>
);

};

export default ProfilePage;
