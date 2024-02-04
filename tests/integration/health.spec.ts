import request from "supertest"
import {app} from "../../src/app.js";

describe('Health controller', () => {
    it('returns health status', async () => {
        const response = await request(app)
            .get("/health");

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty("process");
        expect(response.body).toHaveProperty("system");
    });
});
