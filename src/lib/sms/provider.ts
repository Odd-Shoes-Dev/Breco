// SMS provider stub — not yet implemented.
// To add SMS: implement against Africa's Talking, Twilio, etc.
// Swap this file only.

export async function sendSms(_to: string, _message: string): Promise<void> {
  throw new Error('SMS provider not configured. Implement src/lib/sms/provider.ts');
}
