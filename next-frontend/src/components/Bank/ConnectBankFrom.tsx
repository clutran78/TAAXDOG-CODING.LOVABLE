'use client'

import React, { useState } from 'react'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import Cookies from 'js-cookie'
import { getData, postData } from '@/services/api/apiController'
import { auth, db } from '@/lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { addDoc, collection, deleteDoc, getDocs, query, where } from 'firebase/firestore'

const ConnectBankForm = () => {
  const [connections, setConnections] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)


  const [accounts, setAccounts] = useState<any[]>([])
  const [accountLoading, setAccountLoading] = useState(false)
  const [accountError, setAccountError] = useState<string | null>(null)



  const [transactions, setTransactions] = useState([])
  const [txnLoading, setTxnLoading] = useState(false)
  const [txnError, setTxnError] = useState('')
  const [activeAccountId, setActiveAccountId] = useState<any>(null)



  const formik = useFormik({
    initialValues: {
      email: '',
      mobile: '',
      firstName: '',
      lastName: '',
      businessName: '',
      businessIdNo: '',
      verificationDate: '',
      addressLine1: '',
      suburb: '',
      state: '',
      postcode: '',
      countryCode: 'AUS'
    },
    validationSchema: Yup.object({
      email: Yup.string().email('Invalid email').required('Email is required'),
      mobile: Yup.string()
        .matches(/^\+?\d{10,15}$/, 'Invalid mobile format').required("Mobile is required"),
      firstName: Yup.string().required('First name is required'),
      lastName: Yup.string().required('Last name is required'),
      businessName: Yup.string().required('Business name is required'),
      businessIdNo: Yup.string()
        .matches(/^\d{11}$/, 'Must be a valid 11-digit ABN')
        .required('Business ID is required'),
      verificationDate: Yup.string()
        .matches(/^\d{2}\/\d{2}\/\d{4}$/, 'Date must be in DD/MM/YYYY format')
        .required('Verification date is required'),
      addressLine1: Yup.string().required('Address Line 1 is required'),
      suburb: Yup.string().required('Suburb is required'),
      state: Yup.string().required('State is required'),
      postcode: Yup.string().required('Postcode is required'),
      countryCode: Yup.string().required('Country code is required'),
    }),
    onSubmit: async (values, { setSubmitting, setStatus }) => {
      const token = Cookies.get('auth-token')
      if (!token) {
        setStatus('User not authenticated')
        return
      }

      const payload = {
        email: values.email,
        mobile: values.mobile,
        firstName: values.firstName,
        lastName: values.lastName,
        businessName: values.businessName,
        businessIdNo: values.businessIdNo,
        businessIdNoType: 'ABN',
        verificationStatus: true,
        verificationDate: values.verificationDate,
        businessAddress: {
          addressLine1: values.addressLine1,
          suburb: values.suburb,
          state: values.state,
          postcode: values.postcode,
          countryCode: values.countryCode
        }
      }

      try {
        const config = {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }

        const response = await postData('/api/banking/setup-user', payload, config)
        console.log('✅ User created/setup:', response)
        debugger
        const authRes = await postData('/api/banking/auth-link', {}, config)
        debugger
        if (authRes.success && authRes.auth_link) {
          window.location.href = authRes.auth_link?.links?.public
        } else {
          setError('Could not get Basiq connect link')
        }
      } catch (err: any) {
        console.error('❌ Setup error:', err)
        setError(err?.response?.data?.error || 'Something went wrong')
      } finally {
        setSubmitting(false)
      }
    }
  })

  const fetchConnections = async () => {
    const token = Cookies.get('auth-token')
    if (!token) {
      setError('User is not authenticated')
      return
    }

    const config = {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }

    try {
      setLoading(true)
      setError(null)
      const response = await getData('/api/banking/connections', config)
      console.log('✅ Basiq connections:', response)

      if (response.success) {
        setConnections([response.connections]) // wrap the single object in an array
        setLastUpdated(new Date().toLocaleTimeString())
      } else {
        setError(response.error || 'Unable to fetch connections')
      }
    } catch (err: any) {
      console.error('❌ Failed to fetch Basiq connections:', err)
      setError(err?.response?.data?.error || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const fetchAccounts = async () => {
    const token = Cookies.get('auth-token')
    if (!token) {
      setAccountError('User not authenticated')
      return
    }

    const config = {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }

    try {
      setAccountLoading(true)
      setAccountError(null)
      const res = await getData('/api/banking/accounts', config)
      debugger
      console.log("res", res);

      if (res.success) {
        setAccounts(res.accounts.data || []) // Use .data to extract list
      } else {
        setAccountError(res.error || 'Failed to load accounts')
      }
    } catch (err: any) {
      console.error('❌ Failed to fetch accounts:', err)
      setAccountError(err?.response?.data?.error || 'Something went wrong')
    } finally {
      setAccountLoading(false)
    }
  }


  const clearOldTransactions = async (userId: string, accountId: string) => {
    debugger
    const q = query(
      collection(db, 'bankTransactions'),
      where('userId', '==', userId),
      where('accountName', '==', accountId)
    )
    const snapshot = await getDocs(q)
    const deletions = snapshot.docs.map(doc => deleteDoc(doc.ref))
    await Promise.all(deletions)
  }

  const fetchTransactions = async (accountId: string) => {
    const token = Cookies.get('auth-token')
    if (!token) {
      setTxnError('User not authenticated')
      return
    }

    try {
      setTxnLoading(true)
      setTxnError('')
      setActiveAccountId(accountId)

      const filter = `account.id.eq('${accountId}')`
      const res = await getData(`/api/banking/transactions?filter=${encodeURIComponent(filter)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      onAuthStateChanged(auth, async (user) => {
        if (res.success) {
          const rawTxns = res.transactions.data || []
          if (!user) {
            console.error('No authenticated user found. Cannot fetch user-specific data.');
            return;
          }
          const formattedTxns = rawTxns.map((txn: any) => ({
            userId: user?.uid,
            id: txn.id,
            date: txn.postDate,
            description: txn.description || 'No description',
            amount: txn.amount,
            merchant: txn.institution || 'Unknown',
            category: txn.class || 'Uncategorized',
            accountName: txn.account || '',
            createdAt: new Date().toISOString()
          }))
          debugger
          // Optionally: clear previous transactions for that user/account
          await clearOldTransactions(user?.uid, accountId)

          debugger

          // Add to Firestore
          for (const txn of formattedTxns) {
            await addDoc(collection(db, 'bankTransactions'), txn)
          }

          setTransactions(rawTxns)
        } else {
          setTxnError(res.error || 'Failed to load transactions')
        }
      })
    } catch (err: any) {
      console.error('❌ Transaction fetch failed:', err)
      setTxnError(err?.message || 'Something went wrong')
    } finally {
      setTxnLoading(false)
    }
  }


  return (
    <div className="max-w-3xl mx-auto p-6 space-y-12">
      {/* 🔹 Form */}
      <div className="bg-white shadow-xl border border-gray-100 p-8 rounded-lg transition-all duration-300">
        <h2 className="text-3xl font-extrabold text-blue-700 mb-6">Connect Your Bank</h2>

        <form onSubmit={formik.handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { name: 'email', label: 'Email', type: 'email' },
              { name: 'mobile', label: 'Mobile', type: 'text' },
              { name: 'firstName', label: 'First Name', type: 'text' },
              { name: 'lastName', label: 'Last Name', type: 'text' },
              { name: 'businessName', label: 'Business Name', type: 'text' },
              { name: 'businessIdNo', label: 'Business ID (ABN)', type: 'text' },
              { name: 'verificationDate', label: 'Verification Date (DD/MM/YYYY)', type: 'text' },
              { name: 'addressLine1', label: 'Address Line 1', type: 'text' },
              { name: 'suburb', label: 'Suburb', type: 'text' },
              { name: 'state', label: 'State', type: 'text' },
              { name: 'postcode', label: 'Postcode', type: 'text' },
              { name: 'countryCode', label: 'Country Code', type: 'text' },
            ].map(({ name, label, type }) => {
              const hasError =
                formik.touched[name as keyof typeof formik.touched] &&
                formik.errors[name as keyof typeof formik.errors]

              return (
                <div key={name} className="relative">
                  <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">
                    {label}
                  </label>
                  <input
                    id={name}
                    name={name}
                    type={type}
                    value={formik.values[name as keyof typeof formik.values]}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    className={`w-full px-4 py-2 pr-10 rounded-md shadow-sm focus:outline-none focus:ring-2 transition duration-300 ${hasError
                      ? 'border-2 border-red-500 text-red-700 focus:ring-red-400'
                      : 'border border-gray-300 focus:ring-blue-500'
                      }`}
                  />
                  {hasError && (
                    <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                      <svg
                        className="w-5 h-5 text-red-500"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 9v2m0 4h.01M12 2a10 10 0 110 20 10 10 0 010-20z"
                        />
                      </svg>
                    </div>
                  )}
                  {hasError && (
                    <p className="text-red-500 text-xs mt-1">
                      {formik.errors[name as keyof typeof formik.errors]}
                    </p>
                  )}
                </div>
              )
            })}
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={formik.isSubmitting}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition duration-300"
            >
              {formik.isSubmitting ? 'Submitting...' : 'Connect Bank'}
            </button>
            {formik.status && <p className="mt-2 text-sm text-gray-600">{formik.status}</p>}
            {error && <p className="text-red-500 mt-2 text-sm">{error}</p>}
          </div>
        </form>
      </div>

      {/* 🔗 Connections */}
      <div className="bg-white shadow-xl border border-gray-100 p-6 rounded-lg transition-all duration-300">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold text-gray-800">Your Bank Connections</h2>
          <button
            onClick={fetchConnections}
            className="bg-gray-800 text-white px-4 py-2 rounded-md hover:bg-gray-900 transition duration-300"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {lastUpdated && (
          <p className="text-sm text-gray-400 mb-4">
            Last updated: {lastUpdated}
          </p>
        )}

        {connections.length > 0 ? (
          <ul className="space-y-4">
            {connections.map((conn) => (
              <li
                key={conn.id}
                className="border border-gray-200 p-4 rounded-lg bg-gray-50 hover:bg-white transition duration-300 shadow-sm"
              >
                <p className="text-gray-800"><strong>Type:</strong> {conn.type}</p>
                <p className="text-gray-800"><strong>Mobile:</strong> {conn.mobile}</p>
                <p className="text-gray-800"><strong>User ID:</strong> {conn.userId}</p>
                <p className="text-gray-800"><strong>Expires At:</strong> {new Date(conn.expiresAt).toLocaleString()}</p>
                <p className="text-blue-600 underline break-all">
                  <a href={conn.links?.public} target="_blank" rel="noopener noreferrer">Open Connection</a>
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">
            No connections found
          </p>
        )}

        {error && <p className="text-red-500 mt-4">{error}</p>}
      </div>


      {/* dfsdfsd */}

      <div className="bg-white shadow-md border p-6 rounded-lg mt-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Your Bank Accounts</h2>
          <button
            onClick={fetchAccounts}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
          >
            {accountLoading ? 'Loading...' : 'Load Accounts'}
          </button>
        </div>

        {accountError && <p className="text-red-500">{accountError}</p>}

        {accounts.length > 0 ? (
          <ul className="space-y-4">
            {accounts.map((acc) => {
              const balance = parseFloat(acc.balance || '0')
              const productType = acc.class?.type || 'account'
              const isActive = acc.id === activeAccountId

              return (
                <li
                  key={acc.id}
                  className="border border-gray-200 p-5 rounded-lg bg-white hover:shadow-md transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="text-3xl">
                        {productType === 'transaction' && '🏦'}
                        {productType === 'savings' && '💰'}
                        {productType === 'credit-card' && '💳'}
                        {productType === 'mortgage' && '🏠'}
                        {productType === 'account' && '📄'}
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold text-gray-800">
                          {acc.name || acc.class?.product || 'Unnamed Account'}
                        </h3>
                        <p className="text-sm text-gray-500">{acc.accountHolder || '—'}</p>
                        <p className="text-sm text-gray-400">
                          Type: {acc.class?.type || acc.type}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className={`text-xl font-bold ${balance >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {balance < 0 ? '-' : ''}${Math.abs(balance).toFixed(2)}
                      </p>
                      {acc.creditLimit && (
                        <p className="text-xs text-gray-400">
                          Credit Limit: ${parseFloat(acc.creditLimit).toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>

                  <hr className="my-4 border-gray-200" />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-600">
                    <div><strong>Account No:</strong> {acc.accountNo || '—'}</div>
                    <div><strong>BSB:</strong> {acc.bsb || '—'}</div>
                    <div><strong>Currency:</strong> {acc.currency || 'AUD'}</div>
                    <div><strong>Status:</strong> {acc.status || 'available'}</div>
                    <div><strong>Institution:</strong> {acc.institution || 'AU Institution'}</div>
                    <div>
                      <strong>Updated:</strong>{' '}
                      {acc.lastUpdated ? new Date(acc.lastUpdated).toLocaleDateString() : '—'}
                    </div>
                  </div>

                  <div className="mt-4">
                    <button
                      onClick={() =>
                        isActive ? setActiveAccountId(null) : fetchTransactions(acc.id)
                      }
                      className="text-blue-600 text-sm underline hover:text-blue-800"
                    >
                      {isActive ? 'Hide Transactions' : 'View Transactions →'}
                    </button>
                  </div>

                  {isActive && (
                    <>
                      {txnLoading && <p className="text-gray-600 mt-4">Loading transactions...</p>}
                      {txnError && <p className="text-red-500 mt-4">{txnError}</p>}

                      {transactions.length > 0 ? (
                        <div className="mt-4">
                          <h3 className="text-md font-semibold text-gray-700 mb-2">Transactions</h3>
                          <ul className="space-y-3">
                            {transactions.map((txn:any) => {
                              const isDebit = txn.direction === 'debit'
                              const date = txn.postDate ? new Date(txn.postDate).toLocaleDateString() : '—'
                              const amount = parseFloat(txn.amount || '0')

                              return (
                                <li key={txn.id} className="bg-gray-50 border p-3 rounded text-sm">
                                  <div className="flex justify-between">
                                    <span className="font-medium">
                                      {txn.description || '(No description)'}
                                    </span>
                                    <span className={`font-semibold ${isDebit ? 'text-red-600' : 'text-green-600'}`}>
                                      {isDebit ? '-' : '+'}${Math.abs(amount).toFixed(2)}
                                    </span>
                                  </div>

                                  <div className="text-xs text-gray-500 mt-1">
                                    {date} &middot; {txn.direction || '—'} &middot; {txn.class || 'Unclassified'}
                                  </div>
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      ) : (
                        !txnLoading && <p className="text-sm text-gray-500 mt-2">No transactions found.</p>
                      )}
                    </>
                  )}
                </li>
              )
            })}
          </ul>

        ) : (
          <p className="text-gray-500">No accounts found.</p>
        )}
      </div>

      {/* -------------------------------------------------------------------- */}






    </div>
  )

}

export default ConnectBankForm
