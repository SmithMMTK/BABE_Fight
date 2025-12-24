require('dotenv').config();
const sql = require('mssql');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: true,
    trustServerCertificate: false,
    connectTimeout: 10000,
  },
};

console.log('Connecting to:', process.env.DB_SERVER);
console.log('Database:', process.env.DB_NAME);
console.log('User:', process.env.DB_USER);
console.log('');

sql.connect(config)
  .then(pool => {
    console.log('✅ Successfully connected to Azure SQL Database!');
    console.log('');
    return pool.request().query('SELECT @@VERSION AS Version');
  })
  .then(result => {
    console.log('SQL Server Version:');
    console.log(result.recordset[0].Version);
    console.log('');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Connection failed:');
    console.error(err.message);
    console.error('');
    console.error('Troubleshooting:');
    console.error('1. Check firewall rules: az sql server firewall-rule list --resource-group babe-fight-rg --server ' + process.env.DB_SERVER.split('.')[0]);
    console.error('2. Verify password is correct');
    console.error('3. Ensure your IP (' + process.env.DB_SERVER + ') is whitelisted');
    process.exit(1);
  });
