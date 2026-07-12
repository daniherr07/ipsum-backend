const bcrypt = require("bcrypt");

// Envuelve bcrypt.compare (estilo callback) en una promesa para poder usar
// await + try/catch en vez de un throw síncrono dentro del callback — un
// throw ahí no tiene ningún try/catch alrededor, así que sería una
// excepción sin manejar capaz de tumbar el proceso completo. Compartido
// entre /login y /changePassword.
function comparePassword(password, hash) {
  return new Promise((resolve, reject) => {
    bcrypt.compare(password, hash, (err, isMatch) => {
      if (err) return reject(err);
      resolve(isMatch);
    });
  });
}

module.exports = comparePassword;
