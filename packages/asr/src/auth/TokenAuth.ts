/**
 * Token authentication
 */

import type { AuthHeaders } from "./types.js";

/**
 * Generate Token authentication headers
 */
export class TokenAuth {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  /**
   * Get authentication headers
   */
  getHeaders(): AuthHeaders {
    return {
      Authorization: `Bearer; ${this.token}`,
    };
  }

  /**
   * Static method for quick header generation
   */
  static createHeaders(token: string): AuthHeaders {
    return {
      Authorization: `Bearer; ${token}`,
    };
  }
}
