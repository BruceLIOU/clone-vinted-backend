// Import du package 'express'
const express = require("express");

// Appel à la fonction Router(), issue du package 'express'
const router = express.Router();

// import Stripe
const stripe = require("stripe")(process.env.STRIPE_KEY_SECRET);

// Import du middleware isAuthenticated
const isAuthenticated = require("../middlewares/isAuthenticated");

// route POST /payment
router.post("/payment", isAuthenticated, async (req, res) => {
  try {
    // Réception du token créer via l'API Stripe depuis le Frontend
    const stripeToken = req.fields.stripeToken;
    // Créer la transaction
    const response = await stripe.charges.create({
      amount: Number(req.fields.total) * 100, // payment cts
      currency: "eur",
      description: req.fields.productTitle,
      // On envoie ici le token
      source: stripeToken,
    });

    res.status(200).json(response);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
