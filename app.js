import express from "express";
import cors from "cors";
import morgan from "morgan";
import bodyParser from "body-parser";
import session from "express-session";
import mongoDBStore from "connect-mongodb-session";

import APIRoutes from "./api/api.js";
import auditMiddleware from "./middlewares/audit.js";

import businessModel from "./models/business/model.js";
import cartModel from "./models/cart/model.js";
import permissionModel from "./models/permission/model.js";
import productModel from "./models/product/model.js";
import productTypeModel from "./models/productType/model.js";
import promoModel from "./models/promo/model.js";
import userModel from "./models/user/model.js";
import statesModel from "./models/state/model.js";
import userPermissionModel from "./models/userPermission/model.js";
import auditLogModel from "./models/auditLog/model.js";

// Load environment variables
process.loadEnvFile();

const mongodburl = process.env.DB_HOST;
const sessionSecret = process.env.SESSION_SECRET;

// Initialize the Express application
const sessionStore = mongoDBStore(session);
const app = express();
const store = new sessionStore({
  uri: mongodburl,
  collection: "sessions", // Collection name for storing sessions
});

// Middleware to enable CORS
// This allows cross-origin requests, which is useful for APIs
app.use(cors());

// Middleware to parse JSON bodies
// This is necessary for handling JSON data in requests
app.use(express.json());

// Set the view engine to Pug
app.set("view engine", "pug");

// Middleware to log HTTP requests
app.use(morgan("dev"));

// Middleware to parse URL-encoded bodies
app.use(bodyParser.urlencoded({ extended: true }));

// Middleware to handle sessions
app.use(
  session({
    secret: sessionSecret, // Replace with your own secret key
    resave: false,
    saveUninitialized: false,
    store,
  })
);

app.use(auditMiddleware(auditLogModel));

/**
 * @route /api
 * @description Routes for API-related operations
 */
app.use(
  "/api",
  APIRoutes({
    businessModel,
    cartModel,
    permissionModel,
    productModel,
    productTypeModel,
    promoModel,
    userModel,
    statesModel,
    userPermissionModel,
    auditLogModel,
  })
);

export default app;