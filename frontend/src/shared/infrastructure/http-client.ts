import axios, { type AxiosInstance } from 'axios';

export function createHttpClient(baseURL: string): AxiosInstance {
  return axios.create({
    baseURL,
    timeout: 15_000,
    headers: { Accept: 'application/json' },
  });
}
