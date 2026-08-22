import { _initSecretKey } from '@tieout/api/src/security/jwt.js';

export function register() {
  // Validate JWT secret on API startup
  _initSecretKey();
}
