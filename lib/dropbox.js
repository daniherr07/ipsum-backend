require("dotenv").config();
var dropboxV2Api = require("dropbox-v2-api");
const cache = require("./cache");

const CLIENT_ID = process.env.DROPBOX_CLIENT_ID_DANI;
const CLIENT_SECRET = process.env.DROPBOX_CLIENT_SECRET_DANI;
const REFRESH_TOKEN = process.env.DROPBOX_REFRESH_TOKEN_DANI;

// Dropbox emite tokens de corta duración (~4h). Antes se pedía uno nuevo en
// CADA llamada a initializeDropbox(), así que subir varias fotos a la vez
// (Promise.all sobre addFileDropbox) disparaba un refresh de token por
// archivo. Cachearlo elimina casi todas esas llamadas repetidas. TTL de 3h
// para quedar con margen de sobra antes de que Dropbox lo invalide.
const TOKEN_TTL_MS = 3 * 60 * 60 * 1000;

/*async function getRefreshToken() {
    const params = new URLSearchParams({
      code: "3c4DGY7R4LAAAAAAAAAA6yYrmkFcgWuSo8WeY1e4ohg",
      grant_type: "authorization_code",
      client_id: process.env.DROPBOX_CLIENT_ID_DANI,
      client_secret: process.env.DROPBOX_CLIENT_SECRET_DANI,
    });

    const res = await fetch("https://api.dropboxapi.com/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const data = await res.json();
    console.log(data);
}

getRefreshToken()*/

async function getAccessToken() {
  // getOrSet no cachea si fn() lanza un error, así que un fallo de red o de
  // credenciales no queda "guardado" como si fuera un token válido.
  return cache.getOrSet("dropboxAccessToken", TOKEN_TTL_MS, async () => {
    const response = await fetch("https://api.dropbox.com/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        refresh_token: REFRESH_TOKEN,
        grant_type: "refresh_token",
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw errorData;
    }

    const data = await response.json();
    return data.access_token;
  });
}

// Ejecutar para obtener un nuevo token

async function initializeDropbox() {
  const token = await getAccessToken();

  const dropbox = dropboxV2Api.authenticate({
    token: token,
  });

  return dropbox;
}

module.exports = initializeDropbox;
