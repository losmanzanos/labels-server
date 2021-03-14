const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

function makeUsersArray() {
  return [
    {
      id: 1,
      user_name: "test-user-1",
      full_name: "Test user 1",

      password: "password",
      date_created: new Date("2029-01-22T16:28:32.615Z"),
    },
    {
      id: 2,
      user_name: "test-user-2",
      full_name: "Test user 2",

      password: "password",
      date_created: new Date("2029-01-22T16:28:32.615Z"),
    },
    {
      id: 3,
      user_name: "test-user-3",
      full_name: "Test user 3",

      password: "password",
      date_created: new Date("2029-01-22T16:28:32.615Z"),
    },
    {
      id: 4,
      user_name: "test-user-4",
      full_name: "Test user 4",

      password: "password",
      date_created: new Date("2029-01-22T16:28:32.615Z"),
    },
  ];
}

function makeImagesArray(users) {
  return [
    {
      id: 1,
      url: "test.com/image/jpg",
      user_id: users[0].id,
    },
    {
      id: 2,
      url: "test.com/image/jpg",
      user_id: users[1].id,
    },
    {
      id: 3,
      url: "test.com/image/jpg",
      user_id: users[2].id,
    },
  ];
}

function makeFeaturesArray(users, Images) {
  return [
    {
      id: 1,
      label: "Photograph",
      language: "en",
      date_created: new Date("2029-01-22T16:28:32.615Z"),
      image_id: 1,
      user_id: users[0].id,
    },
    {
      id: 2,
      label: "Highlands",
      language: "en",
      date_created: new Date("2029-01-22T16:28:32.615Z"),
      image_id: 2,
      user_id: users[1].id,
    },
    {
      id: 3,
      label: "Real estate",
      language: "en",
      date_created: new Date("2029-01-22T16:28:32.615Z"),
      image_id: 3,
      user_id: users[2].id,
    },
  ];
}

function makeExpectedImages(users, article, comments = []) {
  const author = users.find((user) => user.id === article.author_id);

  const number_of_comments = comments.filter(
    (comment) => comment.article_id === article.id
  ).length;

  return {
    id: article.id,
    style: article.style,
    title: article.title,
    content: article.content,
    date_created: article.date_created.toISOString(),
    number_of_comments,
    author: {
      id: author.id,
      user_name: author.user_name,
      full_name: author.full_name,

      date_created: author.date_created.toISOString(),
      date_modified: author.date_modified || null,
    },
  };
}

// function makeExpectedArticleComments(users, articleId, comments) {
//   const expectedComments = comments.filter(
//     (comment) => comment.article_id === articleId
//   );

//   return expectedComments.map((comment) => {
//     const commentUser = users.find((user) => user.id === comment.user_id);
//     return {
//       id: comment.id,
//       text: comment.text,
//       date_created: comment.date_created.toISOString(),
//       user: {
//         id: commentUser.id,
//         user_name: commentUser.user_name,
//         full_name: commentUser.full_name,
//         nickname: commentUser.nickname,
//         date_created: commentUser.date_created.toISOString(),
//         date_modified: commentUser.date_modified || null,
//       },
//     };
//   });
// }

function makeMaliciousImages(user) {
  const maliciousArticle = {
    id: 911,
    style: "How-to",
    date_created: new Date(),
    title: 'Naughty naughty very naughty <script>alert("xss");</script>',
    author_id: user.id,
    content: `Bad image <img src="https://url.to.file.which/does-not.exist" onerror="alert(document.cookie);">. But not <strong>all</strong> bad.`,
  };
  const expectedArticle = {
    ...makeExpectedImages([user], maliciousArticle),
    title:
      'Naughty naughty very naughty &lt;script&gt;alert("xss");&lt;/script&gt;',
    content: `Bad image <img src="https://url.to.file.which/does-not.exist">. But not <strong>all</strong> bad.`,
  };
  return {
    maliciousArticle,
    expectedArticle,
  };
}

function makeImagesFixtures() {
  const testUsers = makeUsersArray();
  const testImages = makeImagesArray(testUsers);
  const testFeatures = makeFeaturesArray(testImages);
  return { testUsers, testImages, testFeatures };
}

function cleanTables(db) {
  return db.transaction((trx) =>
    trx
      .raw(
        `TRUNCATE
        images,
        users,
        features
      `
      )
      .then(() =>
        Promise.all([
          trx.raw(`ALTER SEQUENCE images_id_seq minvalue 0 START WITH 1`),
          trx.raw(`ALTER SEQUENCE users_id_seq minvalue 0 START WITH 1`),
          trx.raw(`ALTER SEQUENCE features_id_seq minvalue 0 START WITH 1`),
          trx.raw(`SELECT setval('images_id_seq', 0)`),
          trx.raw(`SELECT setval('users_id_seq', 0)`),
          trx.raw(`SELECT setval('features_id_seq', 0)`),
        ])
      )
  );
}

function seedUsers(db, users) {
  const preppedUsers = users.map((user) => ({
    ...user,
    password: bcrypt.hashSync(user.password, 1),
  }));
  return db
    .into("users")
    .insert(preppedUsers)
    .then(() =>
      // update the auto sequence to stay in sync
      db.raw(`SELECT setval('users_id_seq', ?)`, [users[users.length - 1].id])
    );
}

function seedImagesTables(db, users, Images, comments = []) {
  // use a transaction to group the queries and auto rollback on any failure
  return db.transaction(async (trx) => {
    await seedUsers(trx, users);
    await trx.into("images").insert(Images);
    // update the auto sequence to match the forced id values
    await trx.raw(`SELECT setval('images_id_seq', ?)`, [
      Images[Images.length - 1].id,
    ]);
    // only insert comments if there are some, also update the sequence counter
    if (comments.length) {
      await trx.into("features").insert(comments);
      await trx.raw(`SELECT setval('features_id_seq', ?)`, [
        comments[comments.length - 1].id,
      ]);
    }
  });
}

function seedMaliciousImages(db, user, article) {
  return seedUsers(db, [user]).then(() => db.into("images").insert([article]));
}

function makeAuthHeader(user, secret = process.env.JWT_SECRET) {
  const token = jwt.sign({ user_id: user.id }, secret, {
    subject: user.user_name,
    algorithm: "HS256",
  });
  return `Bearer ${token}`;
}

module.exports = {
  makeUsersArray,
  makeImagesArray,
  makeExpectedImages,
  makeMaliciousImages,

  makeImagesFixtures,
  cleanTables,
  seedImagesTables,
  seedMaliciousImages,
  makeAuthHeader,
  seedUsers,
};
