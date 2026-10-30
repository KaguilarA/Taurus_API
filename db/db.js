import {OwlMongoConnect} from 'owl-expressjs-utils';

import { loadEnvironment, runtimeConfig } from "../config/runtime.js";
export default async function connectDatabase(config) {
  if (!config) {
    loadEnvironment();
    config = runtimeConfig(process.env);
  }
  return OwlMongoConnect(config.uri, { dbName: config.dbName });
}
