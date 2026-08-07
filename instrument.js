// Import with `import * as Sentry from "@sentry/node"` if you are using ESM
const Sentry = require("@sentry/node");
const { nodeProfilingIntegration } = require("@sentry/profiling-node");

Sentry.init({
  dsn: "https://7c7e3d43cf900a4b425715eccdf3f408@o4509901041500160.ingest.us.sentry.io/4511855251030016",
  integrations: [
    nodeProfilingIntegration(),
  ],

  // Send structured logs to Sentry
  enableLogs: true,
  // Tracing
  tracesSampleRate: 1.0, //  Capture 100% of the transactions
  // Set sampling rate for profiling - this is evaluated only once per SDK.init call
  profileSessionSampleRate: 1.0,
  // Trace lifecycle automatically enables profiling during active traces
  profileLifecycle: 'trace',
  // Deshabilitado explícitamente (no dejado en el default del SDK): la
  // base de datos de este sistema tiene PII real de producción (cédulas,
  // nombres, correos, hashes de contraseña — ver advertencia en CLAUDE.md
  // sobre IpsumDatabase.sql), y varias rutas reciben esos mismos datos en
  // el body del request (login, insertMember, insertUser, etc.). Sentry no
  // debe recibir ni el cuerpo de esos requests ni datos de usuario/IP.
  dataCollection: {
    userInfo: false,
    httpBodies: [],
  },
});
