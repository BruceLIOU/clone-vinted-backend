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

      // Upload profile picture
      if (req.fields.avatar) {
        let pictureToUpload = req.files.avatar.path; // Local link to picture
        const result = await cloudinary.uploader.upload(pictureToUpload, {
          folder: `/vinted/users/${newUser._id}`,
        }); // Cloudinary upload result

        // Adding the picture's details to the newUser (better to save the whole result in case we need other picture data)
        newUser.account.avatar = result;
      }

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

module.exports = router;
