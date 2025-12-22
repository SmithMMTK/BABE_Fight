// Generate easy-to-remember 4-digit PIN
export function generatePIN() {
  // Avoid confusing numbers: 0, 1 (too similar to O, I)
  // Use memorable patterns
  const digits = '23456789';
  let pin = '';
  for (let i = 0; i < 4; i++) {
    pin += digits[Math.floor(Math.random() * digits.length)];
  }
  return pin;
}

// Generate unique PINs for a game
export function generateUniquePINs(existingPINs) {
  let hostPin, guestPin;
  
  do {
    hostPin = generatePIN();
  } while (existingPINs.includes(hostPin));
  
  do {
    guestPin = generatePIN();
  } while (existingPINs.includes(guestPin) || guestPin === hostPin);
  
  return { hostPin, guestPin };
}
