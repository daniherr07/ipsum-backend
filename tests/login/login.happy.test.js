const request = require("supertest");

afterEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

describe("POST /login - happy path", () => {
  it("Debería retornar un código 200 si el usuario existe", async () => {
    jest.resetModules();

    // 1) Mock del módulo correcto
    jest.doMock("../../lib/db", () => ({
      select: jest.fn().mockResolvedValue([{ id: 1, password: "hashed", estado: 1 }]),
    }));

    // El mock global de "bcrypt" (tests/setup.js) no ejecuta el callback por
    // defecto, así que aquí se simula un match exitoso de contraseña para
    // que la ruta /login pueda responder en el "happy path".
    jest.doMock("bcrypt", () => ({
      compare: jest.fn((password, hash, callback) => callback(null, true)),
    }));

    // 2) Requerir app *después* del mock
    const app = require("../../app");

    // 3) Ejecutar request
    const res = await request(app)
      .post("/login")
      .send({ email: "test@example.com", password: "123" });

    // 4) Validaciones
    // La ruta /login responde con el objeto de usuario directamente
    // (userSelect[0]), no con un arreglo, así que se valida sobre res.body.
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("id", 1);

    // 5) Ahora sí: obtener el módulo mockeado
    const db = require("../../lib/db");

    expect(db.select).toHaveBeenCalled();
  });

  it("Debería pedir cambio de contraseña si estado = 0", async () => {
    jest.resetModules();

    jest.doMock("../../lib/db", () => ({
      select: jest
        .fn()
        .mockResolvedValue([{ id: 2, nombre: "Nuevo", password: "hashed", estado: 0 }]),
    }));

    jest.doMock("bcrypt", () => ({
      compare: jest.fn((password, hash, callback) => callback(null, true)),
    }));

    const app = require("../../app");

    const res = await request(app)
      .post("/login")
      .send({ email: "nuevo@example.com", password: "Ipsum2024*" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      requiresPasswordChange: true,
      id: 2,
      nombre: "Nuevo",
    });
  });
});
