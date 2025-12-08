// Simple load test script using autocannon
const autocannon = require('autocannon');

const url = process.argv[2] || 'http://localhost:3000/api/scout/health';
const connections = parseInt(process.argv[3], 10) || 50;
const duration = parseInt(process.argv[4], 10) || 20;

console.log(`Running load test: ${url} (${connections} connections, ${duration}s)`);

autocannon({
  url,
  connections,
  duration,
  headers: { 'Content-Type': 'application/json' },
  method: 'GET',
}, (err, result) => {
  if (err) throw err;
  console.log(autocannon.printResult(result));
});
