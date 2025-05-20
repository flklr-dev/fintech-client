import { AxiosInstance } from 'axios';

declare module 'axios' {
  interface AxiosInstance {
    setAuthToken(token: string): void;
    clearAuthToken(): void;
  }
}
 