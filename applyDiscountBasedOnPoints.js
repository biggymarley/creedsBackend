const { default: axios } = require("axios");
const getAccessToken = require("./getAccessToken");

async function reduceUserPoints(
  userId,
  points,
  userPoints,
  productPrice,
  userEmail
) {
  // Implement your database logic to reduce points
  const accessToken = await getAccessToken();
  const credit =
    userPoints - Math.ceil(points) >= 0 ? userPoints - Math.ceil(points) : 0;
  const response = await axios.patch(
    `https://xlyq-uzsi-spoj.n7d.xano.io/api:wcke9BSb/usersCredit/${userId}`,
    {
      credit: credit,
      users_id: userId,
    },
    {
      headers: {
        "Content-Type": "application/json", // Ensure content type is JSON
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  await sendUserEmail(
    userId,
    points,
    productPrice,
    userEmail,
    credit,
    accessToken
  );
  console.log(
    `Reducing ${points} points from ${userPoints} for user ${userId}`
  );
}

async function sendUserEmail(
  userId,
  points,
  productPrice,
  userEmail,
  credit,
  accessToken
) {
  // Implement your database logic to reduce points

  const email = `<!DOCTYPE html>
<html>
<head>
<title>Exciting news! 🎉</title>
<style>
    body { font-family: Arial, sans-serif; line-height: 1.6; }
    .container { width: 90%; max-width: 600px; margin: 0 auto; background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
    .button { background-color: #28a745; color: #fff; padding: 10px 20px; text-align: center; display: inline-block; border-radius: 5px; text-decoration: none; }
    .footer { font-size: 0.8em; text-align: center; color: #666; }
</style>
</head>
<body>
<div class="container"> 
<p><strong>Next Adventure Awaits!</strong></p>
<p>Your upcoming journey would typically cost <strong>$${
    productPrice / 100
  }</strong>, but thanks to your valor and bonuses</p>
<p> the new cost is <strong>$${productPrice / 100 - points}</strong>!</p>
<p>You still have <strong>${credit} gold coins</strong> remaining to aid you on your future quests!hese coins will automatically be applied to your subscriptions until your treasure is depleted to <strong>0</strong></p>
<p style="color: #ff6347;">
    ⚠️ If you decide to cancel your subscription after the discount is applied, any remaining bonus points for that cycle will be lost, so plan your journey wisely!
</p>
    <p>If you have any questions or need assistance, feel free to reach out to us.</p>
    <p>Best regards,</p>
    <p>Creeds Codex</p>
    <div class="footer">
        <p>© 2024 Creeds Codex. All rights reserved.</p>
    </div>
</div>
</body>
</html>`;

  //   const accessToken = await getAccessToken();
  const response = await axios.post(
    `https://xlyq-uzsi-spoj.n7d.xano.io/api:FhdvSZPQ/sendCommentNotif`,
    {
      body: email,
      email: userEmail,
      sub: "Your Next Quest is Discounted! ⚔️ Save Gold on Your Upcoming Journey!",
    },
    {
      headers: {
        "Content-Type": "application/json", // Ensure content type is JSON
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  console.log(`Email sent to ${userEmail}`);
}

async function applyDiscountBasedOnPoints(user, stripe) {
  try {
    // console.log(user);
    if (user.subId && user.hasAdiscount === false) {
      const points = user.points;
      if (points > 0) {
        const discountAmount = user.discountAmount; // Convert points to cents (10 points = $10)
        // Create a new promo code or apply the discount directly
        const coupon = await stripe.coupons.create({
          amount_off: discountAmount,
          currency: "usd",
        });
        // Apply the coupon to the upcoming invoice
        await stripe.subscriptions.update(user.subId, {
          discounts: [{ coupon: coupon.id }],
        });
        console.log("Done");
        // Optionally, reduce the user's points after applying the discount
        await reduceUserPoints(
          user.id,
          user.discountAmount / 100,
          user.points / 100,
          user.productPrice,
          user.userEmail
        );
      }
    }
  } catch (error) {
    console.error(
      `Failed to apply discount for user ${user.id}: ${error.message}`
    );
  }
}

module.exports = applyDiscountBasedOnPoints;
