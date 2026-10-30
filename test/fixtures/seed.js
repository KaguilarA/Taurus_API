import {
  Accounts,
  Settings,
  Product,
  Promotion,
  Movement,
} from "../../restaurant/models.js";
import mongoose from "mongoose";
import { usernameInput } from "../../restaurant/domain.js";

export async function seed({ email, username, password, demo = false }) {
  if (!(await Settings.getOne({ key: "main" })))
    await Settings.save({
      key: "main",
      name: "FELOS BAR",
      subtitle: "RESTAURANTE, BAR Y PUB",
      tagline: "Aquí se sirven buenos momentos.",
      description:
        "Comida tica, cervezas bien frías y buena compañía. Tu punto de encuentro en Tranquerillas, Aserrí.",
      heroImage: "/images/hero.svg",
      address: "Tranquerillas, Aserrí",
      hours: "",
      phone: "6028-3584 / 6469-6160",
      currency: "CRC",
      accent: "#F5A623",
      servings: { large: 90, small: 60, shot: 30 },
    });
  if (
    email &&
    password &&
    !(await Accounts.getOne({
      $or: [
        { email: email.toLowerCase() },
        ...(username ? [{ username: username.toLowerCase() }] : []),
      ],
    }))
  ) {
    if (password.length < 8)
      throw new Error("ADMIN_PASSWORD requiere al menos 8 caracteres.");
    await Accounts.save({
      email: email.toLowerCase(),
      password,
      username: username ? usernameInput(username) : undefined,
    });
  }
  // Give existing email-based accounts a username without changing their password.
  const accountModel = mongoose.model("RestaurantAccount");
  for (const account of await accountModel
    .find({ username: { $exists: false } })
    .sort({ createdAt: 1 })) {
    const base = (
      account.email
        .split("@")[0]
        .toLowerCase()
        .replace(/[^a-z0-9._-]/g, "-")
        .slice(0, 30) || "user"
    ).padEnd(3, "0");
    const candidate =
      account.email === email?.toLowerCase() && username
        ? usernameInput(username)
        : base;
    const taken = await accountModel.exists({
      username: candidate,
      _id: { $ne: account._id },
    });
    await Accounts.update(String(account._id), {
      username: taken ? `${base}-${String(account._id).slice(-6)}` : candidate,
    });
  }
  const currentSettings = await Settings.getOne({ key: "main" });
  if (currentSettings.accent?.toLowerCase() === "#b9ef70")
    await Settings.update(String(currentSettings._id), { accent: "#F5A623" });
  if (!demo || (await Product.countDocuments())) return;
  const products = await Product.create([
    {
      name: "Papas tostadas de la casa",
      description:
        "Crujientes, con sal y limón. La botana para acompañar tu bebida.",
      category: "snack",
      inventory: "none",
      price: 1800,
      image: "/images/nachos.svg",
    },
    {
      name: "Burger de la casa",
      description:
        "Carne a la parrilla, cheddar, cebolla caramelizada y nuestra salsa especial.",
      category: "food",
      inventory: "none",
      price: 6500,
      image: "/images/burger.svg",
      featured: true,
    },
    {
      name: "Nachos para compartir",
      description:
        "Tortillas crujientes, queso fundido, frijoles y pico de gallo.",
      category: "food",
      inventory: "none",
      price: 5500,
      image: "/images/nachos.svg",
      featured: true,
    },
    {
      name: "Alitas BBQ",
      description:
        "Ocho alitas, salsa de la casa y una buena excusa para quedarse.",
      category: "food",
      inventory: "none",
      price: 5900,
      image: "/images/wings.svg",
    },
    {
      name: "Ron de la casa",
      description: "Ron añejo. Elegí tu medida y disfrutalo a tu manera.",
      category: "drink",
      inventory: "ml",
      price: 2000,
      prices: { large: 4500, small: 3200, shot: 2000 },
      stock: 3000,
      minimum: 500,
      bottleMl: 1000,
      image: "/images/rum.svg",
      featured: true,
    },
    {
      name: "Whisky reserva",
      description: "Notas de roble, vainilla y un final suave.",
      category: "drink",
      inventory: "ml",
      price: 3000,
      prices: { large: 6500, small: 4500, shot: 3000 },
      stock: 450,
      minimum: 500,
      bottleMl: 750,
      image: "/images/whisky.svg",
    },
    {
      name: "Cerveza artesanal",
      description: "Bien fría, local y con mucho carácter. Botella de 355 ml.",
      category: "drink",
      inventory: "unit",
      price: 2800,
      stock: 24,
      minimum: 6,
      image: "/images/beer.svg",
      featured: true,
    },
  ]);
  await Movement.create(
    products
      .filter((p) => p.inventory !== "none")
      .map((p) => ({
        productId: String(p._id),
        productName: p.name,
        delta: p.stock,
        balance: p.stock,
        unit: p.inventory,
        reason: "Carga inicial de demostración",
      })),
  );
  await Promotion.create({
    title: "La mejor hora es aquí.",
    description:
      "Happy hour · Consultá en barra las bebidas participantes. Martes a jueves de 4 a 6 p. m.",
    image: "/images/rum.svg",
    starts: new Date("2026-01-01"),
    ends: new Date("2028-01-01"),
    active: true,
  });
}
