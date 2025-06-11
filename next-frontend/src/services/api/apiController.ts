import instance from "./apiConfig";

//C L I E N T  S I D E  A P I  C O N T R O L L E R

//-----Get
export const getData = async (endpoint: string, config: any = {}) => {
  try {
    const response = await instance.get(endpoint, config);
    return response?.data;
  } catch (error: any) {
    return Promise.reject(error);
  }
};
//-----Post
export const postData = async (
  endpoint: string,
  dataObj?: any,
  config: any = {}
) => {
  try {
    const response = await instance.post(endpoint, dataObj, config);
    return response?.data;
  } catch (error: any) {
    return Promise.reject(error);
  }
};
//------Put
export const putData = async (endpoint: string, dataObj: any) => {
  try {
    const response = await instance.put(endpoint, dataObj);
    return response.data;
  } catch (error: any) {
    return Promise.reject(error);
  }
};
//-------Delete
export const deleteData = async (endpoint: string, dataObj?: any) => {
  try {
    const response = await instance.delete(endpoint, { data: dataObj });
    return response.data;
  } catch (error: any) {
    return Promise.reject(error);
  }
};

//TO  F E T C H  D A T A  O N  S E R V E R  S I D E
export const fetchDataOnServer = async (
  endpoint: string,
  token?: string,
  isCache?: boolean
) => {
  try {
    const headers: HeadersInit = token
      ? { Authorization: `Bearer ${token}` }
      : {};
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL}${endpoint}`,
      { headers, cache: isCache ? "force-cache" : "no-cache" }
    );
    if (res.ok) {
      const parsedData = await res.json();
      return parsedData;
    } else {
      const data = res;
      return data;
    }
  } catch (error) {
    console.error("Error fetching data:", error);
    throw error; // rethrow the error after logging it
  }
};
