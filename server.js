const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const cron = require("node-cron");
const getUsersWithActiveSubscriptionsAndPoints = require("./getUsersWithActiveSubscriptionsAndPoints");
const applyDiscountBasedOnPoints = require("./applyDiscountBasedOnPoints");
require("dotenv").config();
const corsOptions = {
  origin: process.env.ORIGIN,
};
const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());
app.use(express.json());

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

app.post("/api/userSession", async (req, res) => {
  try {
    const { userEmail } = req.body;
    const customers = await stripe.customers.list({
      email: userEmail,
      limit: 1,
    });

    let customerId;

    if (customers.data.length > 0) {
      // Customer already exists
      customerId = customers.data[0].id;
    } else {
      //  Create a new customer if not already present
      const customer = await stripe.customers.create({
        email: userEmail,
      });
      customerId = customer.id;
    }
    const customerSession = await stripe.customerSessions.create({
      customer: customerId,
      components: {
        pricing_table: {
          enabled: true,
        },
      },
    });
    // Send back the promotion code details
    res.status(200).json({
      success: true,
      customerSession: customerSession,
    });
  } catch (error) {
    console.error("Error creating customerSession:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
app.post("/api/create-promo", async (req, res) => {
  try {
    const { amount_off, userEmail } = req.body;

    // 1. Check if the customer already exists in Stripe
    const customers = await stripe.customers.list({
      email: userEmail,
      limit: 1,
    });

    let customerId;

    if (customers.data.length > 0) {
      // Customer already exists
      customerId = customers.data[0].id;
    } else {
      // 2. Create a new customer if not already present
      const customer = await stripe.customers.create({
        email: userEmail,
      });
      customerId = customer.id;
    }

    // 3. Create a Coupon
    const coupon = await stripe.coupons.create({
      amount_off: amount_off,
      currency: "USD",
      duration: "once", // Can be "forever", "once", or "repeating"
    });

    // 4. Create a Promotion Code from the Coupon and associate it with the customer
    const promotionCode = await stripe.promotionCodes.create({
      coupon: coupon.id,
      // code: code, // Optional: Provide a custom code, or omit to auto-generate
      customer: customerId, // Associate the promotion code with the customer
    });

    // Send back the promotion code details
    res.status(200).json({
      success: true,
      promotionCode: promotionCode,
    });
  } catch (error) {
    console.error("Error creating promotion code:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

cron.schedule("*/30 * * * *", async () => {
  console.log("Running daily check for subscriptions with points");

  // Fetch users with active subscriptions and points from your database
  const users = await getUsersWithActiveSubscriptionsAndPoints(stripe);
  console.log(users);
  for (const user of users) {
    await applyDiscountBasedOnPoints(user, stripe);
  }
});
app.listen(5252, () =>
  console.log(`Node server listening at http://localhost:5252`)
);
