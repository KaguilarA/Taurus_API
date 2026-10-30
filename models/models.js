
import { OwlModel } from "owl-expressjs-utils";
import ActionLogData from "./actionLog/model.js";
import BusinessData from "./business/model.js";
import CartData from "./cart/model.js";
import CartItemData from "./cartItem/model.js";
import EmailData from "./email/model.js";
import ImageData from "./image/model.js";
import PermissionData from "./permission/model.js";
import PhoneData from "./phone/model.js";
import PromoData from "./promo/model.js";
import PromoProductData from "./promoProduct/model.js";
import ProductData from "./product/model.js";
import ProductStockData from "./productStock/model.js";
import ProductTypeData from "./productType/model.js";
import StateData from "./state/model.js";
import UserData from "./user/model.js";
import UserPermissionData from "./userPermission/model.js";

export const ActionLogModel = OwlModel(ActionLogData.name, ActionLogData.model);
export const BusinessModel = OwlModel(BusinessData.name, BusinessData.model);
export const CartModel = OwlModel(CartData.name, CartData.model,[],[],{indexes:CartData.indexes});
export const CartItemModel = OwlModel(CartItemData.name, CartItemData.model);
export const EmailModel = OwlModel(EmailData.name, EmailData.model);
export const ImageModel = OwlModel(ImageData.name, ImageData.model);
export const PermissionModel = OwlModel(
  PermissionData.name,
  PermissionData.model,
);
export const PhoneModel = OwlModel(PhoneData.name, PhoneData.model);
export const PromoModel = OwlModel(PromoData.name, PromoData.model);
export const ProductModel = OwlModel(ProductData.name, ProductData.model);
export const PromoProductModel = OwlModel(
  PromoProductData.name,
  PromoProductData.model,
);
export const ProductStockModel = OwlModel(
  ProductStockData.name,
  ProductStockData.model,
);
export const ProductTypeModel = OwlModel(
  ProductTypeData.name,
  ProductTypeData.model,
);
export const StateModel = OwlModel(StateData.name, StateData.model);
export const UserModel = OwlModel(
  UserData.name,
  UserData.model,
  [],
  UserData.hashedFields,
);
export const UserPermissionModel = OwlModel(
  UserPermissionData.name,
  UserPermissionData.model,
);
import EventData from "./event/model.js";
export const EventModel = OwlModel(EventData.name, EventData.model);

import OrderData from "./order/model.js";
export const OrderModel = OwlModel(OrderData.name, OrderData.model);

import StockMovementData from "./stockMovement/model.js";
export const StockMovementModel = OwlModel(
  StockMovementData.name,
  StockMovementData.model,
);

import TableData from "./table/model.js";
export const TableModel = OwlModel(TableData.name, TableData.model);

import SetupLockData from "./setupLock/model.js";
export const SetupLockModel = OwlModel(SetupLockData.name, SetupLockData.model);

import PasswordResetData from "./passwordReset/model.js";
export const PasswordResetModel = OwlModel(
  PasswordResetData.name,
  PasswordResetData.model,
);

export const UserModelName = UserData.name;

export const registeredModels = [ActionLogModel,BusinessModel,CartModel,CartItemModel,EmailModel,ImageModel,PermissionModel,PhoneModel,PromoModel,ProductModel,PromoProductModel,ProductStockModel,ProductTypeModel,StateModel,UserModel,UserPermissionModel,EventModel,OrderModel,StockMovementModel,TableModel,SetupLockModel,PasswordResetModel];
