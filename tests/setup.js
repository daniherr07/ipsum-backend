jest.mock("mysql2/promise");
jest.mock("bcryptjs");
require("dotenv").config({ path: ".env.test" });

// Limpiar mocks para evitar contaminación entre tests
afterEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
});
