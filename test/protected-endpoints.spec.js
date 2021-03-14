const knex = require("knex");
const app = require("../src/app");
const helpers = require("./test-helpers");

describe("Protected endpoints", function () {
  let db;

  const { testUsers, testImages, testComments } = helpers.makeImagesFixtures();

  before("make knex instance", () => {
    db = knex({
      client: "pg",
      connection: process.env.TEST_DB_URL,
    });
    app.set("db", db);
  });

  after("disconnect from db", () => db.destroy());

  before("cleanup", () => helpers.cleanTables(db));

  afterEach("cleanup", () => helpers.cleanTables(db));

  beforeEach("insert images", () =>
    helpers.seedImagesTables(db, testUsers, testImages, testComments)
  );

  const protectedEndpoints = [
    {
      name: "POST /images",
      path: "/images",
      method: supertest(app).post,
    },
    {
      name: "GET /images",
      path: "/images",
      method: supertest(app).get,
    },
    {
      name: "GET /images/:id",
      path: "/images/1",
      method: supertest(app).get,
    },
    {
      name: "DELETE /images/:id",
      path: "/images/1",
      method: supertest(app).delete,
    },
    {
      name: "POST /features",
      path: "/features",
      method: supertest(app).post,
    },
    {
      name: "POST /uploads",
      path: "/uploads",
      method: supertest(app).post,
    },
  ];

  protectedEndpoints.forEach((endpoint) => {
    describe(endpoint.name, () => {
      it(`responds 401 'Missing bearer token' when no bearer token`, () => {
        return endpoint
          .method(endpoint.path)
          .expect(401, { error: `Missing bearer token` });
      });

      it(`responds 401 'Unauthorized request' when invalid JWT secret`, () => {
        const validUser = testUsers[0];
        const invalidSecret = "bad-secret";
        return endpoint
          .method(endpoint.path)
          .set(
            "Authorization",
            helpers.makeAuthHeader(validUser, invalidSecret)
          )
          .expect(401, { error: `Unauthorized request` });
      });

      it(`responds 401 'Unauthorized request' when invalid sub in payload`, () => {
        const invalidUser = { user_name: "user-not-existy", id: 1 };
        return endpoint
          .method(endpoint.path)
          .set("Authorization", helpers.makeAuthHeader(invalidUser))
          .expect(401, { error: `Unauthorized request` });
      });
    });
  });
});
