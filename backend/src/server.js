const app = require('./app');
const env = require('./config/env');
app.listen(env.port, () => {
  console.log(`Air Freight Cost Calculator API running on http://localhost:${env.port}`);
});
