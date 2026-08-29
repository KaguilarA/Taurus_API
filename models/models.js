import { OwlModel } from "owl-expressjs-utils";
import ActionLogData, { ModelName as ActionLogModelName } from "./actionLog/model";
import BusinessData, { ModelName as BusinessModelName } from "./business/model";
import CartData, { ModelName as CartModelName } from "./cart/model";
import CartItemData, { ModelName as CartItemModelName } from "./cartItem/model";
import EmailData, { ModelName as EmailModelName } from "./email/model";
import ImageData, { ModelName as ImageModelName } from "./image/model";
import PermissionData, {
  ModelName as PermissionModelName,
} from "./permission/model";
import PhoneData, { ModelName as PhoneModelName } from "./phone/model";
import PromoData, { ModelName as PromoModelName } from "./promo/model";
import PromoProductData, {
  ModelName as PromoProductModelName,
} from "./promoProduct/model";
import ProductData, { ModelName as ProductModelName } from "./product/model";
import ProductStockData, {
  ModelName as ProductStockModelName,
} from "./productStock/model";
import ProductTypeData, {
  ModelName as ProductTypeModelName,
} from "./productType/model";
import StateData, { ModelName as StateModelName } from "./state/model";
import UserData, {
  ModelName as UserModelName,
  EncryptedFields as UserEncryptedFields,
} from "./user/model";
import UserPermissionData, {
  ModelName as UserPermissionModelName,
} from "./userPermission/model";

export const ActionLogModel = OwlModel(ActionLogModelName, ActionLogData);
export const BusinessModel = OwlModel(BusinessModelName, BusinessData);
export const CartModel = OwlModel(CartModelName, CartData);
export const CartItemModel = OwlModel(CartItemModelName, CartItemData);
export const EmailModel = OwlModel(EmailModelName, EmailData);
export const ImageModel = OwlModel(ImageModelName, ImageData);
export const PermissionModel = OwlModel(PermissionModelName, PermissionData);
export const PhoneModel = OwlModel(PhoneModelName, PhoneData);
export const PromoModel = OwlModel(PromoModelName, PromoData);
export const ProductModel = OwlModel(ProductModelName, ProductData);
export const PromoProductModel = OwlModel(
  PromoProductModelName,
  PromoProductData,
);
export const ProductStockModel = OwlModel(
  ProductStockModelName,
  ProductStockData,
);
export const ProductTypeModel = OwlModel(ProductTypeModelName, ProductTypeData);
export const StateModel = OwlModel(StateModelName, StateData);
export const UserModel = OwlModel(UserModelName, UserData, UserEncryptedFields);
export const UserPermissionModel = OwlModel(
  UserPermissionModelName,
  UserPermissionData,
);
