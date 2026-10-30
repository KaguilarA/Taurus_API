import {
  ActionLogModel,
  BusinessModel,
  CartModel,
  CartItemModel,
  EmailModel,
  ImageModel,
  PermissionModel,
  PhoneModel,
  PromoModel,
  PromoProductModel,
  ProductModel,
  ProductStockModel,
  ProductTypeModel,
  StateModel,
  UserModel,
  UserModelName,
  UserPermissionModel,
} from "./../models/models.js";

import AuthRouter from "../routes/auth/routes.js";
import UserRouter from "../routes/user/routes.js";

export default [
  {
    url: "/auth",
    config: {
      id: "Auth",
      userModel: UserModel,
      userModelName: UserModelName,
      emailModel: EmailModel,
    },
    router: AuthRouter
  },
  {
    url: "/user",
    config: {
      id: "User",
      userModel: UserModel,
      userModelName: UserModelName,
      emailModel: EmailModel,
    },
    router: UserRouter
  }
];