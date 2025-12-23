// Temporary mock database for local development
// This allows the server to start while Azure SQL authentication is being resolved

console.log('⚠️  WARNING: Using MOCK database - for UI development only!');
console.log('⚠️  No data will be persisted. Resolve Azure SQL connection to use real database.');

const db = {
  async query(sql, params = []) {
    console.log('Mock query:', sql.substring(0, 50) + '...');
    return { recordset: [], rowsAffected: [0] };
  },

  async get(sql, params = []) {
    return null;
  },

  async all(sql, params = []) {
    return [];
  },

  async run(sql, params = []) {
    return { lastID: Math.floor(Math.random() * 1000), rowsAffected: [1] };
  },

  async getLastInsertId() {
    return Math.floor(Math.random() * 1000);
  },
};

// Mock initialization
await Promise.resolve();
console.log('⚠️  Mock database "initialized"');

export default db;
