/**
 * Authentication type definitions
 */

export enum AuthMethod {
  TOKEN = "token",
  SIGNATURE = "signature",
}

// Auth config
export interface AuthConfig {
  method: AuthMethod;
  token: string;
  secret?: string;
}

// Auth result (headers)
export interface AuthHeaders {
  [key: string]: string;
}
