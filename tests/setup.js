jest.mock("mysql2/promise");
// El proyecto usa "bcrypt" (no "bcryptjs"); el mock debe apuntar al paquete
// realmente instalado o Jest falla al resolver el módulo.
jest.mock("bcrypt");
require("dotenv").config({ path: ".env.test" });

// Limpiar mocks para evitar contaminación entre tests
afterEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
});
