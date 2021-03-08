const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const multer = require("multer");
const cors = require("cors");
const pool = require("../db");
const path = require("path");
const PORT = process.env.PORT || 9001;
const uploadImage = require("../helpers/helpers");
const authRouter = require("./auth/auth-router");
const usersRouter = require("./users/users-router");
const { requireAuth } = require("./middleware/jwt-auth");

const multerMid = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

//Malcom in the Middleware...

app.disable("x-powered-by");
app.use(cors());
app.use(express.json());
app.use(multerMid.single("file"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use("/auth", authRouter);
app.use("/users", usersRouter);

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "client/build")));
}

//ROUTES

app.get("/", (req, res) => {
  res.send("Hello.");
});

//Post an ImageURL
app.post("/images", requireAuth, async (req, res) => {
  try {
    const { imageURL } = req.body;
    console.log(imageURL);
    const newImageURL = await pool.query(
      "INSERT INTO images (url, user_id) VALUES ($1, $2) RETURNING *",
      [imageURL, req.user.id]
    );

    console.log(newImageURL);

    res.json(newImageURL.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json(err);
  }
});

//Get ALL ImageURLs
app.get("/images", requireAuth, async (req, res) => {
  try {
    console.log("Hello!");
    const allImages = await pool.query(
      "SELECT * FROM images where user_id = $1",
      [req.user.id]
    );

    console.log(allImages);

    res.json(allImages.rows);
  } catch (err) {
    console.error(err.message);
  }
});

//Get an ImageURL by ID
app.get("/images/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const imageURL = await pool.query("SELECT * FROM images WHERE id = $1", [
      id,
    ]);
    res.json(imageURL);
  } catch (err) {
    console.error(err.message);
    res.status(500).json(err);
  }
});

//Delete an ImageURL
app.delete("/images/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deleteImageURL = await pool.query(
      "DELETE FROM images WHERE id = $1",
      [id]
    );

    res.json("Image URL was deleted...");
  } catch (err) {
    console.error("Error:" + err.message);
  }
});

//Get ALL Features by Image ID
app.post("/features", async (req, res) => {
  try {
    const { imageURL, features } = req.body;
    const selectImageURL = await pool.query(
      "SELECT id FROM images WHERE url = $1",
      [imageURL]
    );

    const image_id = selectImageURL.rows[0].id;
    const user_id = 1; //req.user.id
    console.log(features);
    for (i = 0; i < features.length; i++) {
      const label = features[i].label;
      const language = features[i].languageCode;
      const newImageURL = await pool.query(
        "INSERT INTO features (label, language, image_id, user_id) VALUES ($1, $2, $3, $4) RETURNING *",
        [label, language || "Language not found", image_id, user_id]
      );
    }

    res.json({ message: "Features added successfully" });
  } catch (err) {
    console.error(err.message);
  }
});

//Upload Image to Firebase
app.post("/uploads", async (req, res, next) => {
  try {
    const myFile = req.file;
    const imageUrl = await uploadImage(myFile);

    res.status(200).json({
      message: "Upload was successful",
      data: imageUrl,
    });
  } catch (error) {
    next(error);
  }
});

app.use((err, req, res, next) => {
  console.log(err);
  res.status(500).json({
    error: err,
    message: "Internal server error!",
  });
  next();
});

//Get a Feature by ID
app.get("/features/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const imageURL = await pool.query(
      "SELECT * FROM features WHERE image_id = $1",
      [id]
    );

    res.json(imageURL.rows);
  } catch (err) {
    console.error(err.message);
  }
});

module.exports = app;
