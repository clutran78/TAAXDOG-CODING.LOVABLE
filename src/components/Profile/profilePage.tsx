'use client';
import React, { useEffect, useState } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { useSession } from 'next-auth/react';
import { apiRequest } from '@/lib/api-request';
import { showToast } from '@/services/helperFunction';

const validationSchema = Yup.object().shape({
  fullName: Yup.string().required('Full name is required'),
  email: Yup.string().email('Invalid email').required('Email is required'),
  //   phone: Yup.string().required("Phone number is required"),
  address: Yup.string().required('Address is required'),
});

const ProfilePage = () => {
  const { data: session } = useSession();
  const [initialValues, setInitialValues] = useState({
    fullName: '',
    email: '',
    // phone: "",
    address: '',
    profileImageUrl: '',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!session?.user) {
        setLoading(false);
        return;
      }

      try {
        const userData = await apiRequest('/api/user/profile', {
          method: 'GET',
        });

        setInitialValues({
          fullName: userData.name || '',
          email: userData.email || '',
          //   phone: userData.phone || "",
          address: userData.address || '',
          profileImageUrl: userData.image || '',
        });
      } catch (error) {
        console.error('Error fetching user profile:', error);
        showToast('Failed to load profile data', 'danger');
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [session]);

  const handleSubmit = async (values: any) => {
    if (!session?.user) return;

    try {
      await apiRequest('/api/user/profile', {
        method: 'PUT',
        body: {
          name: values.fullName,
          email: values.email,
          //   phone: values.phone,
          address: values.address,
        },
      });
      showToast('Profile updated successfully!', 'success');
    } catch (error) {
      console.error('Error updating profile:', error);
      showToast('Failed to update profile', 'danger');
    }
  };

  return (
    <>
      <div className="container mt-5">
        {loading ? (
          <div
            className="d-flex justify-content-center align-items-center"
            style={{ height: '50vh' }}
          >
            <span
              className="spinner-border text-primary"
              role="status"
              aria-hidden="true"
            ></span>
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
                    <Field
                      name="fullName"
                      type="text"
                      className="form-control"
                    />
                    <ErrorMessage
                      name="fullName"
                      component="div"
                      className="text-danger"
                    />
                  </div>

                  <div className="mb-3">
                    <label>Email</label>
                    <Field
                      name="email"
                      type="email"
                      className="form-control"
                    />
                    <ErrorMessage
                      name="email"
                      component="div"
                      className="text-danger"
                    />
                  </div>

                  <div className="mb-3">
                    <label>Address</label>
                    <Field
                      name="address"
                      type="text"
                      className="form-control"
                    />
                    <ErrorMessage
                      name="address"
                      component="div"
                      className="text-danger"
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Saving...' : 'Save Changes'}
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
