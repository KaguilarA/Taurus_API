import { OwlIsAuth } from "owl-expressjs-utils";
import {
  publicRoutes,
  accountRoutes,
  staffRoutes,
  adminRoutes,
} from "../consts/config.js";
import { authenticateAccount } from "../middlewares/auth/auth.js";
import { allow } from "../middlewares/access/access.js";
export function registerApi(app, context) {
  const runtime = { ...context, application: app.locals };
  const mount = (entries) =>
    entries.forEach(({ url, config, router }) =>
      app.use(url, router({ ...config, ...runtime })),
    );
  mount(publicRoutes);
  app.use("/api/admin", OwlIsAuth, authenticateAccount);
  mount(accountRoutes);
  mount(staffRoutes);
  app.use("/api/admin", allow("admin"));
  mount(adminRoutes);
}
