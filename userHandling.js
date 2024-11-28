const { default: axios } = require("axios");
const getAccessToken = require("./getAccessToken");

// Function to get user details from Xano
async function getUserFromDatabase(userId) {
  try {
    // Fetch access token for authentication
    const accessToken = await getAccessToken();

    // Make a GET request to Xano to retrieve user data
    const response = await axios.get(
      `https://xlyq-uzsi-spoj.n7d.xano.io/api:wcke9BSb/users/${userId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`, // Use the access token for authorization
        },
      }
    );

    // Extract and return user data, including gold coins (GC)
    const user = response.data;
    return {
      userId: user.id,
      goldCoins: user.credit, // Assuming 'credit' field represents gold coins
      userEmail: user.Email, // Assuming 'credit' field represents gold coins
    };
  } catch (error) {
    console.error("Error fetching user from database:", error);
    throw new Error("Failed to retrieve user data from Xano.");
  }
}

// Function to update user GC balance in Xano
async function updateUserGCBalance(userId, newBalance) {
  try {
    // Fetch access token for authentication
    const accessToken = await getAccessToken();

    // Make a PATCH request to Xano to update the user's GC balance
    await axios.patch(
      `https://xlyq-uzsi-spoj.n7d.xano.io/api:wcke9BSb/usersCredit/${userId}`,
      {
        credit: newBalance, // Update the 'credit' field with the new balance
        users_id: userId,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`, // Use the access token for authorization
        },
      }
    );

    console.log(`Updated user ${userId} GC balance to: ${newBalance}`);
  } catch (error) {
    console.error("Error updating user GC balance:", error);
    throw new Error("Failed to update user GC balance in Xano.");
  }
}

module.exports = {
  getUserFromDatabase,
  updateUserGCBalance,
};
