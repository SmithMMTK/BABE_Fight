// Utility function to generate easy-to-remember PINs
function generateEasyPin(length = 4) {
  // Generate numeric PIN that's easy to remember
  let pin = '';
  for (let i = 0; i < length; i++) {
    pin += Math.floor(Math.random() * 10);
  }
  return pin;
}

// Generate 6-character game code
function generateGameCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

module.exports = { generateEasyPin, generateGameCode };
