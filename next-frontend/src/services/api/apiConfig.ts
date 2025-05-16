//-------Request Interceptor 

import axios from "axios";
import Cookies from 'js-cookie'
import { showToast } from "../helperFunction";

export const baseURL = process.env.NEXT_PUBLIC_BASE_URL


export const axiosInstance = axios.create({
    baseURL: process.env.NEXT_PUBLIC_BASE_URL,
    headers: { "Content-Type": "application/json" }
})



//------Response interceptor
axiosInstance.interceptors.response.use((res: any) => {
    return res
}, (error: any) => {
    if (error?.response?.status === 401) {
        localStorage.clear()//clearing the local storage
        Cookies.remove("auth-token")
        setTimeout(() => {
            window.location.replace('/sign-up')
        }, 4000);
        // window.location.reload()
        showToast(error?.response?.data?.message,'danger')
        return
    }
    if (error?.response && error?.response?.data) {
        return Promise.reject({ ...error?.response?.data, status: error?.response?.status })
    }
    // return  Promise.reject(error)
})

export default axiosInstance