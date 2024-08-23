const { default: axios } = require("axios");
const getAccessToken = require("./getAccessToken");



// Function to reduce user points


async function getUsersWithActiveSubscriptionsAndPoints(stripe) {
  try {
    // Step 1: Get access token
    const accessToken = await getAccessToken();

    // Step 2: Fetch users with points from Xano API
    const response = await axios.get(
      "https://xlyq-uzsi-spoj.n7d.xano.io/api:wcke9BSb/users_with_points",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`, // Send the access token in the Authorization header
        },
      }
    );
    const usersWithPoints = response.data;
    const usersWithActiveSubscriptions = [];

    for (const user of usersWithPoints) {
      // Fetch subscriptions for the user from Stripe
      const customers = await stripe.customers.list({
        email: user.Email,
        limit: 1,
      });

      let customerId;

      if (customers.data.length > 0) {
        // Customer already exists
        customerId = customers.data[0].id;
      } else {
        // 2. Create a new customer if not already present
        const customer = await stripe.customers.create({
          email: user.Email,
        });
        customerId = customer.id;
      }
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: "active",
      });

      // Check if the user has any active subscriptions
      if (subscriptions.data.length > 0) {
        const discountAmount = Math.min(
          user.credit * 100,
          subscriptions.data[0].plan.amount
        );
        usersWithActiveSubscriptions.push({
          id: user.id,
          stripeCustomerId: customerId,
          points: user.credit * 100,
          subId: subscriptions.data[0].id,
          productPrice: subscriptions.data[0].plan.amount,
          discountAmount: discountAmount,
          userEmail: user.Email,
          hasAdiscount: subscriptions.data[0].discount ? true : false,
        });
      }
    }

    return usersWithActiveSubscriptions;
    // return accessToken;
  } catch (error) {
    console.error(
      "Error fetching users with active subscriptions and points:",
      error
    );
    return [];
  }
}
module.exports = getUsersWithActiveSubscriptionsAndPoints;
