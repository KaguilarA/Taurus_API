import { OwlMongoConnect } from "owl-expressjs-utils";
import { loadEnvironment, runtimeConfig } from "../config/runtime.js";

export default async () => {
  loadEnvironment();
  const config = runtimeConfig(process.env);
  return OwlMongoConnect(config.uri, { dbName: config.dbName });
};
