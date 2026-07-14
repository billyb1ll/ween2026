/**
 * Hashes a PIN using browser-native SHA-256 with a per-user salt.
 *
 * The salt is derived from the student ID, which is unique per user and
 * known at hashing time on both the registration and login paths.
 *
 * This prevents rainbow table attacks against the small (6-digit) PIN
 * space by ensuring two users with identical PINs produce different hashes.
 *
 * @param pin       - The raw PIN string entered by the user.
 * @param studentId - The student's unique ID used as the hash salt.
 */
export async function hashPin(pin: string, studentId: string): Promise<string> {
  const salted = `${studentId}:${pin}`;
  const msgBuffer = new TextEncoder().encode(salted);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
