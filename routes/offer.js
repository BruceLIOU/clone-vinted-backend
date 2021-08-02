// Import du package 'express'
const express = require("express");
// Appel à la fonction Router(), issue du package 'express'
const router = express.Router();

// Import du package cloudinary
const cloudinary = require("cloudinary").v2;

// Import du model User et Offer
// afin d'éviter des erreurs (notamment dues à d'eventuelles références entre les collections)
// nous vous conseillons d'importer tous vos models dans toutes vos routes
const User = require("../models/User");
const Offer = require("../models/Offer");

// Import du middleware isAuthenticated
const isAuthenticated = require("../middlewares/isAuthenticated");

// Route qui nous permet de récupérer une liste d'annonces, en fonction de filtres
// Si aucun filtre n'est envoyé, cette route renverra l'ensemble des annonces
router.get("/offers", async (req, res) => {
  try {
    // création d'un objet dans lequel on va stocker nos différents filtres
    let filters = {};

    if (req.query.title) {
      filters.product_name = new RegExp(req.query.title, "i");
    }
    // Slider priceMin
    if (req.query.priceMin) {
      filters.product_price = {
        $gte: req.query.priceMin,
      };
    }
    // Slider priceMax
    if (req.query.priceMax) {
      if (filters.product_price) {
        filters.product_price.$lte = req.query.priceMax;
      } else {
        filters.product_price = {
          $lte: req.query.priceMax,
        };
      }
    }

    let sort = {};
    // Swicth desc / asc
    if (req.query.sort === "price-desc") {
      sort = { product_price: -1 };
    } else if (req.query.sort === "price-asc") {
      sort = { product_price: 1 };
    }

    let page;
    if (Number(req.query.page) < 1) {
      page = 1;
    } else {
      page = Number(req.query.page);
    }

    let limit = Number(req.query.limit);

    const offers = await Offer.find(filters)
      .populate({
        path: "owner",
        select: "account",
      })
      .sort(sort)
      .skip((page - 1) * limit) // ignorer les x résultats
      .limit(limit); // renvoyer y résultats

    //console.log(offers);

    // cette ligne va nous retourner le nombre d'annonces trouvées en fonction des filtres
    const count = await Offer.countDocuments(filters);

    res.json({
      count: count,
      offers: offers,
    });
  } catch (error) {
    //console.log(error.message);
    res.status(400).json({ message: error.message });
  }
});

// Route qui permmet de récupérer les informations d'une offre en fonction de son id
router.get("/offer/:id", async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id).populate({
      path: "owner",
      select: "account",
    });
    res.status(200).json(offer);
  } catch (error) {
    //console.log(error.message);
    res.status(400).json({ message: error.message });
  }
});

// route POST to publish an offer
router.post("/offer/publish", isAuthenticated, async (req, res) => {
  try {
    if (
      req.files ||
      req.fields.title ||
      req.fields.description ||
      req.fields.price
    ) {
      // Creating the new offer (and its ID)
      const newOffer = new Offer({
        product_name: req.fields.title,
        product_description: req.fields.description,
        product_price: req.fields.price,
        product_details: [
          { MARQUE: req.fields.brand },
          { TAILLE: req.fields.size },
          { ÉTAT: req.fields.condition },
          { COULEUR: req.fields.color },
          { EMPLACEMENT: req.fields.city },
        ],
        owner: req.user, // Get all user info to avoid populate issues
      });

      // Upload of multiple pictures
      const fileKeys = Object.keys(req.files); // [ 'picture 1', 'picture 2', ... ]

      let results = [];

      // Making sure a file is associated with the files keys
      fileKeys.forEach(async (fileKey) => {
        if (req.files[fileKey].size === 0) {
          console.log("File key exist but no file uploaded");
          res.status(400).json({
            message: "The file is missing",
          });
        } else {
          const filePath = req.files[fileKey].path; // Local path to the picture(s)
          const result = await cloudinary.uploader.upload(filePath, {
            folder: `/api/vinted/offers/${newOffer._id}`,
            public_id: `${fileKey}`,
          });
          console.log(`${fileKey} uploaded`);
          result.public_name = fileKey;
          results.push(result);

          // If there are no more pictures to upload, next!
          if (Object.keys(results).length === fileKeys.length) {
            newOffer.product_pictures = results;
            // Save the newOffer with files details in the DB
            await newOffer.save();
            console.log("Pictures details saved in DB");
            res.status(201).json(newOffer);
          }
        }
      });
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put("/offer/update/:id", isAuthenticated, async (req, res) => {
  const offerToModify = await Offer.findById(req.params.id);
  try {
    if (req.fields.title) {
      offerToModify.product_name = req.fields.title;
    }
    if (req.fields.description) {
      offerToModify.product_description = req.fields.description;
    }
    if (req.fields.price) {
      offerToModify.product_price = req.fields.price;
    }

    const details = offerToModify.product_details;
    for (i = 0; i < details.length; i++) {
      if (details[i].MARQUE) {
        if (req.fields.brand) {
          details[i].MARQUE = req.fields.brand;
        }
      }
      if (details[i].TAILLE) {
        if (req.fields.size) {
          details[i].TAILLE = req.fields.size;
        }
      }
      if (details[i].ÉTAT) {
        if (req.fields.condition) {
          details[i].ÉTAT = req.fields.condition;
        }
      }
      if (details[i].COULEUR) {
        if (req.fields.color) {
          details[i].COULEUR = req.fields.color;
        }
      }
      if (details[i].EMPLACEMENT) {
        if (req.fields.location) {
          details[i].EMPLACEMENT = req.fields.location;
        }
      }
    }

    // Notifie Mongoose que l'on a modifié le tableau product_details
    offerToModify.markModified("product_details");

    if (req.files.picture) {
      const result = await cloudinary.uploader.upload(req.files.picture.path, {
        public_id: `/api/vinted/offers/${offerToModify._id}/preview`,
      });
      offerToModify.product_image = result;
    }

    await offerToModify.save();

    res.status(200).json("Offer modified succesfully !");
  } catch (error) {
    //console.log(error.message);
    res.status(400).json({ error: error.message });
  }
});

router.delete("/offer/delete/:_id", isAuthenticated, async (req, res) => {
  try {
    let offerToDelete = await Offer.findById(req.params._id);

    if (offerToDelete) {
      // Delete assets with a public ID that starts with the given prefix
      await cloudinary.api.delete_resources_by_prefix(
        `/api/vinted/offers/${req.params._id}`
      );
      // Delete the empty folder
      await cloudinary.api.delete_folder(
        `/api/vinted/offers/${req.params._id}`
      );

      // Delete the offer from the DB
      offerToDelete = await Offer.findByIdAndDelete(req.params._id);

      res.status(200).json({
        message: "Your offer has been successfully deleted.",
      });
    } else {
      res.status(400).json({
        message: "Bad request",
      });
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
