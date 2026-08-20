// Auth public interface.
// Application code imports from here — never from provider.ts directly.
export {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  setSessionCookie,
  clearSessionCookie,
  getSession,
  loginUser,
} from './provider';

export type { SessionUser } from './provider';
