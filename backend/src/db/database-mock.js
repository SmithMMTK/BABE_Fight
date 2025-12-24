// Temporary mock database for local development
// This allows the server to start while Azure SQL authentication is being resolved


const db = {
  async query(sql, params = []) {
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

export default db;
