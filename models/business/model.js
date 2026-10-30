const model = {
  key: { type: String, unique: true, sparse: true },
  name: {
    type: String,
    required: true,
    unique: true,
  },
  description: {
    type: String,
    trim: true,
  },
  subtitle: String,
  tagline: String,
  heroImage: String,
  logoImage: String,
  address: String,
  hours: String,
  phone: String,
  currency: String,
  accent: String,
  servings: { large: Number, small: Number, shot: Number },
  instagramUrl: {
    type: String,
    trim: true,
  },
  facebookUrl: {
    type: String,
    trim: true,
  },
  whatsappUrl: {
    type: String,
    trim: true,
  },
  xUrl: {
    type: String,
    trim: true,
  },
};

const name = "Business";

export default { model, name };

export const ModelName = name;
