import { Settings, Event } from "../../restaurant/models.js";

export async function seedFelosBrand({ includeSamples = true } = {}) {
  const settings = await Settings.getOne({ key: "main" });
  await Settings.update(String(settings._id), {
    name: "FELOS BAR",
    tagline: "Aquí se sirven buenos momentos.",
    description:
      "Comida tica, cervezas bien frías y buena compañía. Tu punto de encuentro en Tranquerillas, Aserrí.",
    heroImage: "/images/hero.svg",
    logoImage: "/images/felos-brand-banner.png",
    address: "Tranquerillas, Aserrí",
    phone: "6028-3584 / 6469-6160",
    hours: "",
    accent: "#F5A623",
  });
  if (!includeSamples) return;
  for (const [sampleKey, kind, title, description] of [
    [
      "preview-live-music",
      "music",
      "Música en vivo",
      "Una fría, buena música y el mejor ambiente para compartir.",
    ],
    [
      "preview-karaoke",
      "karaoke",
      "Noche de karaoke",
      "El micrófono está listo. Vení con tu gente y poné la voz.",
    ],
    [
      "preview-sports",
      "sports",
      "El partido se vive aquí",
      "Reuní a tu equipo, pedí algo rico y disfrutá cada jugada.",
    ],
  ]) {
    await Event.updateOne(
      { sampleKey },
      {
        $setOnInsert: {
          sampleKey,
          kind,
          title,
          description,
          image: "",
          starts: null,
          ends: null,
          location: "Felos Bar · Tranquerillas, Aserrí",
          admission: "Por confirmar",
          active: true,
          isSample: true,
        },
      },
      { upsert: true, runValidators: true },
    );
  }
}
