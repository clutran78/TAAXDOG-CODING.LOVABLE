// API Controller for making HTTP requests

interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
}

export const getData = async (url: string, options?: RequestOptions) => {
  try {
    const response = await fetch(url, {
      method: options?.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
};

export const postData = async (url: string, data: any) => {
  return getData(url, {
    method: 'POST',
    body: data,
  });
};

export const putData = async (url: string, data: any) => {
  return getData(url, {
    method: 'PUT',
    body: data,
  });
};

export const deleteData = async (url: string) => {
  return getData(url, {
    method: 'DELETE',
  });
};