import axios, { type AxiosInstance } from 'axios';

export function createHttpClient(baseURL: string): AxiosInstance {
  return axios.create({
    baseURL,
    timeout: 15_000,
    headers: { Accept: 'application/json' },
    // Session cookies are httpOnly; the browser must send them on every API call.
    withCredentials: true,
  });
}
