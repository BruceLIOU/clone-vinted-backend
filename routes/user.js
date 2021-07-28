const express = require("express");
const router = express.Router();

// Import models
const User = require("../models/User");
const Offer = require("../models/Offer");

// Password
const uid2 = require("uid2");
const SHA256 = require("crypto-js/sha256");
const encBase64 = require("crypto-js/enc-base64");

// Generate SALT
const salt = uid2(16);

// Import du package cloudinary
const cloudinary = require("cloudinary").v2;

const faker = require("faker");
faker.locale = "fr";
const owners = require("../data/owners.json");

// route signup
router.post("/user/signup", async (req, res) => {
  try {
    const user = await User.findOne({ email: req.fields.email });
    if (!user) {
      // Generate HASH
      const hash = SHA256(req.fields.password + salt).toString(encBase64);

      // Generate TOKEN
      const token = uid2(64);

      // Create new User
      const newUser = new User({
        email: req.fields.email,
        account: {
          username: req.fields.username,
          phone: req.fields.phone,
        },
        salt: salt,
        hash: hash,
        token: token,
      });

      await newUser.save();
      res.status(200).json({
        _id: newUser._id,
        token: newUser.token,
        account: {
          username: newUser.username,
          phone: newUser.phone,
        },
      });
    } else if (!req.fields.username) {
      res.status(400).json({ message: `Username is required !` });
    } else {
      res
        .status(409)
        .json({ message: `This email (${req.fields.email}) allready exist !` });
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// route login
router.post("/user/login", async (req, res) => {
  try {
    const user = await User.findOne({ email: req.fields.email });
    const newHash = SHA256(req.fields.password + user.salt).toString(encBase64);

    // Generate TOKEN
    const token = uid2(64);

    if (newHash === user.hash) {
      res.status(200).json({
        _id: user._id,
        token: token,
        account: {
          username: user.account.username,
          phone: user.account.phone,
        },
      });
    } else {
      res.status(401).json({ message: "Unauthorized" });
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Réinitalise les users (bdd + cloudinary)
router.get("/reset-users", async (req, res) => {
  if (req.headers.authorization) {
    const token = req.headers.authorization.replace("Bearer ", "");
    console.log(token);

    if (token !== process.env.ADMIN_TOKEN) {
      res.status(401).json({ error: "Unauthorized" });
    } else {
      // Vider la collection User
      await User.deleteMany({});

      // Supprimer le dossier "api/vinted/users" sur cloudinary

      // Pour cela, il faut supprimer les images, cloudinary ne permettant pas de supprimer des dossiers qui ne sont pas vides
      try {
        const deleteResources = await cloudinary.api.delete_resources_by_prefix(
          "api/vinted/users"
        );
        console.log("deleteResources ===>  ", deleteResources);
      } catch (error) {
        console.log("deleteResources ===>  ", error.message);
      }

      // Maintenant les dossiers vides, on peut les supprimer
      try {
        const deleteFolder = await cloudinary.api.delete_folder(
          "api/vinted/users"
        );
      } catch (error) {
        console.log("deleteFolder error ===> ", error.message);
      }

      // Créer les users

      // Admin User
      try {
        const token = uid2(64);
        const salt = uid2(64);
        const hash = SHA256("azerty" + salt).toString(encBase64);

        const adminUser = new User({
          email: "bruceliou@free.fr",
          token: token,
          hash: hash,
          salt: salt,
          account: {
            username: "Bruce",
            phone: "0676090147",
          },
        });

        // uploader la photo de profile de l'admin user
        const resultImage = await cloudinary.uploader.upload(
          faker.random.image(),
          {
            folder: `api/vinted/users/${adminUser._id}`,
            public_id: "avatar",
          }
        );

        adminUser.account.avatar = resultImage;
        // sauvegarder l'admin user dans la BDD
        await adminUser.save();
      } catch (error) {
        res
          .status(404)
          .json({ error: "Error when creating admin user : " + error.message });
      }

      // Random Users
      for (let i = 0; i < owners.length; i++) {
        try {
          // Étape 1 : encrypter le mot de passe
          // Générer le token et encrypter le mot de passe
          const token = uid2(64);
          const salt = uid2(64);
          const hash = SHA256(process.env.PASSWORD_ADMIN + salt).toString(
            encBase64
          );

          // Étape 2 : créer le nouvel utilisateur
          const newUser = new User({
            email: faker.internet.email().toLowerCase(),
            token: token,
            hash: hash,
            salt: salt,
            account: {
              username: owners[i].owner_name || faker.internet.userName(),
              phone: faker.phone.phoneNumber("06########"),
            },
          });

          // Étape 3 : uploader la photo de profile du user
          const resultImage = await cloudinary.uploader.upload(
            owners[i].owner_image || faker.random.image(),
            {
              folder: `api/vinted/users/${newUser._id}`,
              public_id: "avatar",
            }
          );

          newUser.account.avatar = resultImage;
          // Étape 3 : sauvegarder ce nouvel utilisateur dans la BDD
          await newUser.save();
          console.log(`${i + 1} / ${owners.length} users saved`);
        } catch (error) {
          console.log(error.message);
          res.status(400).json({ message: error.message });
        }
      }
      res.status(200).json("🍺 All users saved !");
    }
  } else {
    res.status(400).json({ error: "Unauthorized" });
  }
});

module.exports = router;
