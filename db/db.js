import { OwlMongoConnect } from "owl-expressjs-utils";
import { loadEnvironment, runtimeConfig } from "../restaurant/config.js";

export default async () => {
  loadEnvironment();
  const config = runtimeConfig(process.env);
  return OwlMongoConnect(config.uri, { dbName: config.dbName });
};
