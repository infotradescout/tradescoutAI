import express from "express";
import request from "supertest";
import Stripe from "stripe";
import { describe, expect, it } from "vitest";

function parserApp() {
  const app = express();
  // Match the application's extended form parser and Express query parser.
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));
  app.get("/filters", (req, res) => res.json(req.query));
  app.post("/form", (req, res) => res.json(req.body));
  return app;
}

describe("request encoding after the qs security update", () => {
  it.each([
    "countyFips=22105&types=plumber&types=electrician",
    "countyFips=22105&types%5B%5D=plumber&types%5B%5D=electrician",
  ])("preserves county and repeated service filters: %s", async (query) => {
    const result = await request(parserApp()).get(`/filters?${query}`).expect(200);
    expect(result.body).toEqual({ countyFips: "22105", types: ["plumber", "electrician"] });
  });

  it("preserves an encoded sender name and international phone number", async () => {
    const result = await request(parserApp())
      .post("/form")
      .type("form")
      .send("senderName=Ren%C3%A9e+%26+Lee&senderPhone=%2B1+985+555+0100&countyFips=22105")
      .expect(200);
    expect(result.body).toEqual({
      senderName: "Renée & Lee",
      senderPhone: "+1 985 555 0100",
      countyFips: "22105",
    });
  });

  it("preserves nested form fields and indexed arrays without splitting literal commas", async () => {
    const result = await request(parserApp())
      .post("/form")
      .type("form")
      .send("address[city]=Hammond&services[0]=repair&services[1]=inspection&notes=roof%2C+gutter")
      .expect(200);
    expect(result.body).toEqual({
      address: { city: "Hammond" },
      services: ["repair", "inspection"],
      notes: "roof, gutter",
    });
  });

  it("does not pollute object prototypes through query parameters", async () => {
    const result = await request(parserApp())
      .get("/filters?__proto__[requestEncodingPolluted]=yes&countyFips=22105")
      .expect(200);
    expect(result.body).toEqual({ countyFips: "22105" });
    expect(Object.prototype).not.toHaveProperty("requestEncodingPolluted");
  });

  it("keeps Stripe customer form encoding compatible without sending a network request", async () => {
    let encoded = "";
    let requestCount = 0;
    const stripe = new Stripe("sk_test_synthetic_encoding_fixture", {
      maxNetworkRetries: 0,
      httpClient: Stripe.createFetchHttpClient(
        async (_url: RequestInfo | URL, init?: RequestInit) => {
          requestCount += 1;
          encoded = String(init?.body ?? "");
          return new Response(JSON.stringify({ id: "cus_encoding_fixture", object: "customer" }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
      ),
    });

    await stripe.customers.create({
      name: "Renée & Lee",
      phone: "+1 985 555 0100",
      metadata: { countyFips: "22105" },
      preferred_locales: ["en", "es"],
    });

    expect(requestCount).toBe(1);
    expect(Object.fromEntries(new URLSearchParams(encoded))).toEqual({
      name: "Renée & Lee",
      phone: "+1 985 555 0100",
      "metadata[countyFips]": "22105",
      "preferred_locales[0]": "en",
      "preferred_locales[1]": "es",
    });
  });
});
