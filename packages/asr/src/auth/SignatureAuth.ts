/**
 * HMAC256 Signature authentication
 */

import { createHmac } from "node:crypto";
import { URL } from "node:url";
import { AuthHeaders } from "./types.js";

/**
 * Generate HMAC256 Signature authentication headers
 */
export class SignatureAuth {
  private token: string;
  private secret: string;
  private wsUrl: string;

  constructor(token: string, secret: string, wsUrl: string) {
    this.token = token;
    this.secret = secret;
    this.wsUrl = wsUrl;
  }

  /**
   * Get authentication headers
   */
  getHeaders(requestData?: Buffer): AuthHeaders {
    const url = new URL(this.wsUrl);
    const path = url.pathname || "/";

    // Build input string for signature
    let inputStr = `GET ${path} HTTP/1.1\n`;

    // Custom header (using "Custom" as in Python code)
    const headerValue = "auth_custom";
    inputStr += `${headerValue}\n`;

    // Append request data if provided
    if (requestData) {
      inputStr += requestData.toString("latin1");
    }

    // Calculate HMAC256 signature
    const hmac = createHmac("sha256", this.secret);
    hmac.update(inputStr, "latin1");
    const mac = hmac.digest("base64").replace(/\+/g, "-").replace(/\//g, "_");

    // Build authorization header
    const authHeader = `HMAC256; access_token="${this.token}"; mac="${mac}"; h="${headerValue}"`;

    return {
      Custom: headerValue,
      Authorization: authHeader,
    };
  }

  /**
   * Static method for quick header generation
   */
  static createHeaders(
    token: string,
    secret: string,
    wsUrl: string,
    requestData?: Buffer
  ): AuthHeaders {
    const auth = new SignatureAuth(token, secret, wsUrl);
    return auth.getHeaders(requestData);
  }
}
