const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const corsOptions = {
  origin: process.env.ORIGIN,
};
const storename = "deals4deals";
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

app.listen(5252, () =>
  console.log(`Node server listening at http://localhost:5252`)
);
