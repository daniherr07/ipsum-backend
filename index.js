const app = require('./app')

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Legacy server listening on port ${PORT}...`);
});

module.exports = app;
