afterEach(() => {
  // Limpia cache de módulos y mocks entre tests para evitar contaminación
  jest.resetModules(); // limpia el cache de require()
  jest.clearAllMocks(); // limpia los mocks de jest
});

describe("1- Probar inicialización de la base de datos", () => {
  it("DB health check", async () => {
    jest.resetModules();

    // tests/setup.js auto-mockea mysql2/promise para todos los tests, lo
    // que hace que createPool() devuelva undefined por defecto — hay que
    // darle una implementación real para poder probar checkHealth().
    jest.doMock("mysql2/promise", () => ({
      createPool: jest.fn(() => ({
        query: jest.fn().mockResolvedValue([[{ "1": 1 }]]),
      })),
    }));

    const db = require("../../lib/db");
    const response = await db.checkHealth();

    expect(response).toBe(true);
  });

  it("DB health check devuelve false si la conexión falla", async () => {
    jest.resetModules();

    jest.doMock("mysql2/promise", () => ({
      createPool: jest.fn(() => ({
        query: jest.fn().mockRejectedValue(new Error("connection refused")),
      })),
    }));

    const db = require("../../lib/db");
    const response = await db.checkHealth();

    expect(response).toBe(false);
  });
});
