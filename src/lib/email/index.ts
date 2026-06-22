// Email public interface.
// Application code imports from here — never from provider.ts or resend.ts directly.
// To swap email provider: replace provider.ts only.
export { sendInvoiceEmail, sendPasswordResetEmail } from './provider';
