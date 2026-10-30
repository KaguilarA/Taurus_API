import { registerInitialSetup } from "../routes/setup/routes.js";
import { registerAuth, registerRecovery } from "../routes/auth/routes.js";
import { registerPublic, registerAdminState } from "../routes/public/routes.js";
import {
  publicOrdering,
  staffOrdering,
  registerCart,
} from "../routes/cart/routes.js";
import { registerProfile, registerAccounts } from "../routes/user/routes.js";
import { registerTables } from "../routes/table/routes.js";
import { registerImageUploads } from "../routes/image/routes.js";
import { registerBusiness } from "../routes/business/routes.js";
import {
  registerProduct,
  publicProductRoutes,
} from "../routes/product/routes.js";
import { registerEvent } from "../routes/event/routes.js";
import { registerPromo } from "../routes/promo/routes.js";
import { UserModel, UserModelName, EmailModel } from "../models/models.js";
export const publicRoutes = [
  { url: "/", config: { id: "PublicProduct" }, router: publicProductRoutes },
  { url: "/", config: { id: "Setup" }, router: registerInitialSetup },
  { url: "/", config: { id: "Recovery" }, router: registerRecovery },
  { url: "/", config: { id: "Public" }, router: registerPublic },
  { url: "/", config: { id: "GuestOrders" }, router: publicOrdering },
  {
    url: "/",
    config: {
      id: "Auth",
      userModel: UserModel,
      userModelName: UserModelName,
      emailModel: EmailModel,
    },
    router: registerAuth,
  },
];
export const accountRoutes = [
  { url: "/", config: { id: "Workspace" }, router: registerAdminState },
  {
    url: "/",
    config: { id: "User", userModel: UserModel },
    router: registerProfile,
  },
];
export const staffRoutes = [
  { url: "/", config: { id: "StaffOrders" }, router: staffOrdering },
];
export const adminRoutes = [
  { url: "/", config: { id: "Accounts" }, router: registerAccounts },
  { url: "/", config: { id: "Table" }, router: registerTables },
  { url: "/", config: { id: "Image" }, router: registerImageUploads },
  { url: "/", config: { id: "Business" }, router: registerBusiness },
  { url: "/", config: { id: "Product" }, router: registerProduct },
  { url: "/", config: { id: "Event" }, router: registerEvent },
  { url: "/", config: { id: "Promo" }, router: registerPromo },
  { url: "/", config: { id: "Cart" }, router: registerCart },
];
export default [
  ...publicRoutes,
  ...accountRoutes,
  ...staffRoutes,
  ...adminRoutes,
];
