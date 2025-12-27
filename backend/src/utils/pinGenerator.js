// Generate easy-to-remember 6-digit PIN
export function generatePIN() {
  // Avoid confusing numbers: 0, 1 (too similar to O, I)
  // Use memorable patterns
  const digits = '23456789';
  let pin = '';
  for (let i = 0; i < 6; i++) {
    pin += digits[Math.floor(Math.random() * digits.length)];
  }
  return pin;
}

// Generate unique PINs for a game
export function generateUniquePINs(existingPINs, maxRetries = 100) {
  let hostPin, guestPin;
  let retries = 0;
  
  // Generate host PIN
  do {
    hostPin = generatePIN();
    retries++;
    if (retries > maxRetries) {
      throw new Error('Failed to generate unique host PIN after maximum retries');
    }
  } while (existingPINs.includes(hostPin));
  
  retries = 0;
  // Generate guest PIN
  do {
    guestPin = generatePIN();
    retries++;
    if (retries > maxRetries) {
      throw new Error('Failed to generate unique guest PIN after maximum retries');
    }
  } while (existingPINs.includes(guestPin) || guestPin === hostPin);
  
  return { hostPin, guestPin };
}
