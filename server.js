const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const cron = require('node-cron');
const corsOptions = {
  origin: process.env.ORIGIN,
};
const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());
app.use(express.json());

// Replace if using a different env file or config

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);


app.get("/api/", (req, res) => {
  res.send("path");
});

app.post("/api/userSession",async (req, res) => {
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
})
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




async function applyDiscountBasedOnPoints(user) {
  try {
      const upcomingInvoice = await getUpcomingInvoice(user.stripeCustomerId);

      if (upcomingInvoice) {
          const points = user.points;
          if (points > 0) {
              const discountAmount = points * 100; // Convert points to cents (10 points = $10)

              // Create a new promo code or apply the discount directly
              const coupon = await stripe.coupons.create({
                  amount_off: discountAmount,
                  currency: 'usd',
              });

              // Apply the coupon to the upcoming invoice
              await stripe.invoices.update(upcomingInvoice.id, {
                  discounts: [{ coupon: coupon.id }],
              });

              // Optionally, reduce the user's points after applying the discount
              await reduceUserPoints(user.id, points);
          }
      }
  } catch (error) {
      console.error(`Failed to apply discount for user ${user.id}: ${error.message}`);
  }
}

// Function to get upcoming invoice for a user
async function getUpcomingInvoice(customerId) {
  const invoices = await stripe.invoices.list({
      customer: customerId,
      status: 'open',
  });
  return invoices.data[0] || null;
}

// Function to reduce user points
async function reduceUserPoints(userId, points) {
  // Implement your database logic to reduce points
  console.log(`Reducing ${points} points for user ${userId}`);
}

cron.schedule('0 0 * * *', async () => {
  console.log('Running daily check for subscriptions with points');

  // Fetch users with active subscriptions and points from your database
  const users = await getUsersWithActiveSubscriptionsAndPoints();
  console.log(users)

  // for (const user of users) {
  //     await applyDiscountBasedOnPoints(user);
  // }
});


async function getAccessToken() {
  try {
      const response = await axios.post('https://xlyq-uzsi-spoj.n7d.xano.io/api:wcke9BSb/auth/login', {
          email: 'your_email', // Replace with your Xano account email
          password: 'your_password', // Replace with your Xano account password
      });
      return response.data.authToken; // Adjust based on the actual response structure
  } catch (error) {
      console.error('Error fetching Xano access token:', error);
      throw new Error('Failed to get access token');
  }
}

// Function to fetch users with active subscriptions and points
async function getUsersWithActiveSubscriptionsAndPoints() {
  try {
      // Step 1: Get access token
      const accessToken = await getAccessToken();

      // Step 2: Fetch users with points from Xano API
      const response = await axios.get('https://xlyq-uzsi-spoj.n7d.xano.io/api:wcke9BSb/users_with_points', {
          headers: {
              Authorization: `Bearer ${accessToken}`, // Send the access token in the Authorization header
          },
      });
      const usersWithPoints = response.data;

      const usersWithActiveSubscriptions = [];

      for (const user of usersWithPoints) {
          if (user.stripeCustomerId) {
              // Fetch subscriptions for the user from Stripe
              const subscriptions = await stripe.subscriptions.list({
                  customer: user.stripeCustomerId,
                  status: 'active',
              });

              // Check if the user has any active subscriptions
              if (subscriptions.data.length > 0) {
                  usersWithActiveSubscriptions.push({
                      id: user.id,
                      stripeCustomerId: user.stripeCustomerId,
                      points: user.points,
                  });
              }
          }
      }

      return usersWithActiveSubscriptions;
  } catch (error) {
      console.error('Error fetching users with active subscriptions and points:', error);
      return [];
  }
}
app.listen(5252, () =>
  console.log(`Node server listening at http://localhost:5252`)
);