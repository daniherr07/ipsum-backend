afterEach(() => {
  // Limpia cache de módulos y mocks entre tests para evitar contaminación
  jest.resetModules(); // limpia el cache de require()
  jest.clearAllMocks(); // limpia los mocks de jest
});

describe("1- Probar inicialización de la base de datos", () => {
  it("DB health check", async () => {
    jest.resetModules();

    const db = require("../../lib/db");
    const response = db.checkHealth();

    expect(response).toBe(true);
  });
});
