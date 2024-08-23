const { default: axios } = require("axios");

async function getAccessToken() {
    try {
      const requestBody = {
        Email: process.env.ADMIN_EMAIL, // Replace with your Xano account email
        password: process.env.ADMIN_PASSWORD, // Replace with your Xano account password
      };
      const response = await axios.post(
        "https://xlyq-uzsi-spoj.n7d.xano.io/api:wcke9BSb/auth/login",
        requestBody,
        {
          headers: {
            "Content-Type": "application/json", // Ensure content type is JSON
          },
        }
      );
      return response.data.authToken; // Adjust based on the actual response structure
    } catch (error) {
      console.error("Error fetching Xano access token:", error);
      throw new Error("Failed to get access token");
    }
  }

  module.exports = getAccessToken;
