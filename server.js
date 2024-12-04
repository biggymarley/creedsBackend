const express = require("express");
const Airtable = require("airtable");
const cors = require("cors");
const bodyParser = require("body-parser");
const cron = require("node-cron");
const getUsersWithActiveSubscriptionsAndPoints = require("./getUsersWithActiveSubscriptionsAndPoints");
const applyDiscountBasedOnPoints = require("./applyDiscountBasedOnPoints");
require("dotenv").config();
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID
);
const corsOptions = {
  origin: process.env.ORIGIN,
};
const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());
app.use(express.json());
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

app.get("/api/ping", function (req, res) {
  res.status(200).json({ message: "pong" });
});

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

app.get("/api/search", async (req, res) => {
  const { query } = req.query;

  // Search across multiple tables
  const searchResults = await Promise.all([
    searchTable("Class", query),
    searchTable("Spells", query),
    searchTable("Feats", query),
    searchTable("Path", query),
    searchTable("Magic Items", query),
    searchTable("Equipment", query),
    searchTable("Monsters", query),
    searchTable("Backgrounds", query),
    searchTable("Subclass", query),
    searchTable("Species", query),
    //species
  ]);

  // Flatten and combine the results
  const allResults = searchResults.flat();

  res.json(allResults);
});

async function searchTable(tableName, query) {
  try {
    const records = await base(tableName)
      .select({
        // Selecting the first 3 records in Grid view:
        maxRecords: 10,
        view: "Synced (Do not filter)",
        filterByFormula: `FIND(LOWER("${query}"), LOWER({Name}))`,
      })
      .firstPage();

    return records.map((record) => {
      let tablePath;
      switch (tableName) {
        case "Class":
          tablePath = "classdetails";
          break;
        case "Spells":
          tablePath = "spellsdetails";
          break;
        case "Feats":
          tablePath = "featdetails";
          break;
        case "Path":
          tablePath = "featpathdetails";
          break;
        case "Magic Items":
          tablePath = "magicitemdetails";
          break;
        case "Equipment":
          tablePath = "equipmentdetails";
          break;
        case "Species":
          tablePath = "speciesdetails";
          break;
        case "Monsters":
          tablePath = "monsterdetails";
          break;
        case "Backgrounds":
          tablePath = "backgrounddetails";
          break;
        case "Subclass":
          tablePath = "subclassdetails";
          break;
        default:
          tablePath = "";
      }

      return {
        id: record.id,
        name: record.get("Name"),
        access: record.get("Access"),
        table: tableName,
        url: `https://www.creedscodex.com/${tablePath}/${record.get("path")}`,
      };
    });
  } catch (err) {
    console.error(`Error searching table "${tableName}":`, err);
    return [];
  }
}

cron.schedule("0 0 * * *", async () => {
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
