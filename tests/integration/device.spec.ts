import request from "supertest"
import {app} from "../../src/app.js";

describe('Device controller', () => {
    it('returns list of active devices', async () => {
        const response = await request(app)
            .get("/devices");

        expect(response.status).toBe(200);
        expect(response.body).toEqual({"count": 0, "items": []});
    });
});
