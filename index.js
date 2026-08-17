import { OwlModel } from "owl-expressjs-utils";

import db from "./db/db.js";
import app from "./app.js";

process.loadEnvFile();

const PORT = process.env.PORT || 4000;

// Start the server
app.listen(PORT, () => {
  db();
  console.log(`Server is running on port ${PORT}`);
});
