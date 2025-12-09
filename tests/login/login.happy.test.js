

const request = require("supertest");
const app = require("../../app");



describe("Login – Happy Path", () => {
  it("debería devolver 401 si el usuario no existe", async () => {

    const res = await request(app).get("/login")

    expect(res.status).toBe(200);
    expect(res.body.error).toBe("Hello World!");
  });
});
