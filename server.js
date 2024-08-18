const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const corsOptions = {
  origin: process.env.ORIGIN,
};
const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors(corsOptions));
app.use(express.json());

// Replace if using a different env file or config

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2022-08-01",
});


app.get("/api/", (req, res) => {
  res.send("path");
});


app.post("/api/create-promo", async (req, res) => {
  try {
    const { amount_off, currency, code } = req.body;

    // 1. Create a Coupon
    const coupon = await stripe.coupons.create({
      amount_off: amount_off,
      currency: "USD",
      duration: "once", // Can be "forever", "once", or "repeating"
    });

    // 2. Create a Promotion Code from the Coupon
    const promotionCode = await stripe.promotionCodes.create({
      coupon: coupon.id,
      code: code, // Optional: Provide a custom code, or omit to auto-generate
    });

    // Send back the promotion code details
    res.status(200).json({
      success: true,
      coupon: coupon,
      promotionCode: promotionCode,
    });
  } catch (error) {
    console.error("Error creating promotion code:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(5252, () =>
  console.log(`Node server listening at http://localhost:5252`)
);
