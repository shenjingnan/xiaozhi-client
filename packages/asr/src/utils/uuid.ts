/**
 * UUID utility
 */

import { v4 as uuidv4 } from "uuid";

/**
 * Generate a unique request ID
 */
export function generateReqId(): string {
  return uuidv4();
}

/**
 * Generate a short ID
 */
export function generateShortId(): string {
  return uuidv4().split("-")[0];
}
