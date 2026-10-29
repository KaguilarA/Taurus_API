import { OwlModel } from "owl-expressjs-utils";
import ActionLogData from "./actionLog/model";
import BusinessData from "./business/model";
import CartData from "./cart/model";
import CartItemData from "./cartItem/model";
import EmailData from "./email/model";
import ImageData from "./image/model";
import PermissionData from "./permission/model";
import PhoneData from "./phone/model";
import PromoData from "./promo/model";
import PromoProductData from "./promoProduct/model";
import ProductData from "./product/model";
import ProductStockData from "./productStock/model";
import ProductTypeData from "./productType/model";
import StateData from "./state/model";
import UserData from "./user/model";
import UserPermissionData from "./userPermission/model";

export const ActionLogModel = OwlModel(ActionLogData.name, ActionLogData.model);
export const BusinessModel = OwlModel(BusinessData.name, BusinessData.model);
export const CartModel = OwlModel(CartData.name, CartData.model);
export const CartItemModel = OwlModel(CartItemData.name, CartItemData.model);
export const EmailModel = OwlModel(EmailData.name, EmailData.model);
export const ImageModel = OwlModel(ImageData.name, ImageData.model);
export const PermissionModel = OwlModel(PermissionData.name, PermissionData.model);
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
export const ProductTypeModel = OwlModel(ProductTypeData.name, ProductTypeData.model);
export const StateModel = OwlModel(StateData.name, StateData.model);
export const UserModel = OwlModel(UserData.name, UserData.model, UserData.encryptedFields);
export const UserPermissionModel = OwlModel(
  UserPermissionData.name,
  UserPermissionData.model,
);