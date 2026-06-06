console.log('Loading authMiddleware.js - start');
import { verifyToken } from '@clerk/backend';

// The Clerk issuer must match the actual Clerk application instance.
// Using the wrong issuer (e.g. the generic 'https://clerk.dev') causes every
// JWT verification to fail with a signature/issuer mismatch, returning 401.
// This must stay in sync with collab.js which uses the same issuer value.
const CLERK_ISSUER =
  process.env.CLERK_ISSUER || 'https://ethical-javelin-15.clerk.accounts.dev';

const authMiddleware = async (req, res, next) => {
  console.log('authMiddleware called for route:', req.url);
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = await verifyToken(token, {
      jwtKey: process.env.CLERK_JWT_VERIFICATION_KEY,
      authorizedParties: ['https://docsy-client.vercel.app', 'http://localhost:3000'],
      issuer: CLERK_ISSUER,
      clockSkewInSec: 60, // Match collab.js; handles edge-case clock drift
    });
    req.userId = payload.sub;
    next();
  } catch (error) {
    console.error('[authMiddleware] Token verification failed:', error.message);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};
console.log('Loading authMiddleware.js - end');
export default authMiddleware;