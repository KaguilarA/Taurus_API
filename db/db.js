import mongoose from "mongoose";

process.loadEnvFile();

const mongodburl = process.env.DB_HOST;

/**
 * Connect to MongoDB
 * @returns {Promise<void>}
 * @throws {Error} If the connection fails
 */
export default async () => {
  try {
    await mongoose.connect(mongodburl);
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection failed:", error);
    process.exit(1);
  }
}