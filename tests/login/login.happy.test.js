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
      select: jest.fn().mockResolvedValue([{ id: 1 }]),
    }));

    // 2) Requerir app *después* del mock
    const app = require("../../app");

    // 3) Ejecutar request
    const res = await request(app)
      .post("/login")
      .send({ nombre: "test", password: "123" });

    // 4) Validaciones
    expect(res.status).toBe(200);
    expect(res.body[0]).toHaveProperty("id", 1);

    // 5) Ahora sí: obtener el módulo mockeado
    const db = require("../../lib/db");

    expect(db.select).toHaveBeenCalled();
  });
});
