import { OwlTransaction } from "owl-expressjs-utils";
import {
  UserModel,
  ProductModel,
  StockMovementModel,
  TableModel,
} from "../../models/models.js";
import { randomBytes } from "node:crypto";

// Prices and opening quantities are editable examples, not market price claims.
export const previewProducts = [
  {
    name: "Imperial",
    category: "drink",
    drinkType: "alcoholic",
    price: 2000,
    description: "Cerveza Imperial bien fría.",
    image: "/images/beer.svg",
  },
  {
    name: "Pilsen",
    category: "drink",
    drinkType: "alcoholic",
    price: 2000,
    description: "Cerveza Pilsen bien fría.",
    image: "/images/beer.svg",
  },
  {
    name: "Corona",
    category: "drink",
    drinkType: "alcoholic",
    price: 2800,
    description: "Cerveza Corona, servida fría con limón.",
    image: "/images/beer.svg",
  },
  {
    name: "Silver",
    category: "drink",
    drinkType: "alcoholic",
    price: 2000,
    description: "Cerveza Imperial Silver bien fría.",
    image: "/images/beer.svg",
  },
  {
    name: "Coca-Cola",
    category: "drink",
    drinkType: "non_alcoholic",
    price: 1500,
    description: "Refresco Coca-Cola individual, bien frío.",
    image: "/images/cola.svg",
  },
  {
    name: "Hamburguesa",
    category: "food",
    price: 6500,
    description:
      "Carne a la parrilla, queso, lechuga, tomate y salsa de la casa.",
    image: "/images/burger.svg",
    featured: true,
  },
  {
    name: "Chifrijo",
    category: "food",
    price: 5500,
    description: "Arroz, frijoles, chicharrón, pico de gallo y tortillas.",
    image: "/images/chifrijo.svg",
    featured: true,
  },
  {
    name: "Carne surtida",
    category: "food",
    price: 9500,
    description:
      "Plato de carnes a la parrilla para compartir, con acompañamientos.",
    image: "/images/carne-surtida.svg",
  },
  {
    name: "Tronaditas",
    category: "snack",
    price: 800,
    description: "Paquete individual de Tronaditas para acompañar tu bebida.",
    image: "/images/snack-tronaditas.svg",
  },
  {
    name: "Chicharrones de paquete",
    category: "snack",
    price: 1000,
    description: "Chicharrones crujientes en paquete individual.",
    image: "/images/snack-chicharrones.svg",
  },
  {
    name: "Plátanos verdes de paquete",
    category: "snack",
    price: 900,
    description: "Platanitos verdes crujientes en paquete individual.",
    image: "/images/snack-platanos.svg",
  },
];

export async function seedPreviewData({ resetAdminPassword = false } = {}) {
  let account = await UserModel.getOne({ username: "admin" });
  if (!account)
    account = await UserModel.save({
      username: "admin",
      email: "admin@accounts.local",
      name: "Administrador",
      role: "admin",
      password: "12345678",
    });
  else if (resetAdminPassword)
    await UserModel.update(String(account._id), {
      password: "12345678",
      role: "admin",
    });
  for (const [index, sample] of previewProducts.entries()) {
    const sampleKey = `preview-${index + 1}`;
    await OwlTransaction(async (session) => {
      if (
        await ProductModel.exists(
          {
            $or: [{ sampleKey }, { name: sample.name }],
          },
          { session: session },
        )
      )
        return;
      const [product] = await ProductModel.saveMany(
        [
          {
            ...sample,
            sampleKey,
            inventory: sample.category === "drink" ? "unit" : "none",
            stock: sample.category === "drink" ? 24 : 0,
            minimum: sample.category === "drink" ? 6 : 0,
            active: true,
          },
        ],
        { session },
      );
      if (product.stock)
        await StockMovementModel.saveMany(
          [
            {
              productId: product.id,
              productName: product.name,
              delta: product.stock,
              balance: product.stock,
              unit: "unit",
              reason: "Carga inicial de prueba",
            },
          ],
          { session },
        );
    });
  }
  if (!(await TableModel.exists({ name: "Mesa 01" })))
    await TableModel.save({
      name: "Mesa 01",
      token: randomBytes(24).toString("hex"),
    });
  return {
    username: "admin",
    products: previewProducts.length,
    seededProducts: await ProductModel.countDocuments({
      sampleKey: { $in: previewProducts.map((_, i) => `preview-${i + 1}`) },
    }),
  };
}
