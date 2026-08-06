const app = require('./app')
require("./instrument.js");

// All other imports below
// Import with `import * as Sentry from "@sentry/node"` if you are using ESM
const Sentry = require("@sentry/node");
Sentry.setupExpressErrorHandler(app);

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Legacy server listening on port ${PORT}...`);
});

module.exports = app;
