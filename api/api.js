import { allow } from "../middlewares/access/access.js";
import { registerAccounts } from "../routes/user/routes.js";
import { registerTables } from "../routes/table/routes.js";
import { authenticateAccount } from "../middlewares/auth/auth.js";
import { registerAdminState } from "../routes/public/routes.js";
import { registerCart } from "../routes/cart/routes.js";
import { registerPromo } from "../routes/promo/routes.js";
import { registerEvent } from "../routes/event/routes.js";
import { registerProduct } from "../routes/product/routes.js";
import { registerBusiness } from "../routes/business/routes.js";

import { registerPublic } from "../routes/public/routes.js";
import { registerRecovery, registerAuth } from "../routes/auth/routes.js";
import { registerProfile } from "../routes/user/routes.js";

import { OwlIsAuth } from "owl-expressjs-utils";
import { Accounts } from "../models/models.js";
import { Problem } from "../services/validation.js";

import { publicOrdering, staffOrdering } from "../routes/cart/routes.js";

import { registerImageUploads } from "../routes/image/routes.js";
import { registerInitialSetup } from "../routes/setup/routes.js";

export function registerApi(app, { origin, production, uploadImage }) {
  app.use(
    registerInitialSetup({ origin, production, application: app.locals }),
  );
  app.use(registerRecovery({ origin, production, application: app.locals }));
  app.use(registerPublic({ origin, production, application: app.locals }));

  app.use(publicOrdering({ origin, production, application: app.locals }));
  app.use(registerAuth({ origin, production, application: app.locals }));

  app.use("/api/admin", OwlIsAuth);
  app.use("/api/admin", authenticateAccount);

  app.use(registerAdminState({ origin, production, application: app.locals }));
  app.use(registerProfile({ origin, production, application: app.locals }));
  app.use(staffOrdering({ origin, production, application: app.locals }));
  app.use("/api/admin", allow("admin"));
  app.use(registerAccounts({ origin, production, application: app.locals }));
  app.use(registerTables({ origin, production, application: app.locals }));
  app.use(
    registerImageUploads({
      origin,
      production,
      application: app.locals,
      uploadImage,
    }),
  );
  app.use(registerBusiness({ origin, production, application: app.locals }));
  app.use(registerProduct({ origin, production, application: app.locals }));
  app.use(registerEvent({ origin, production, application: app.locals }));

  app.use(registerPromo({ origin, production, application: app.locals }));

  app.use(registerCart({ origin, production, application: app.locals }));
}
