import { OwlModel } from "owl-expressjs-utils";

const BusinessData = {
  name: {
    type: String,
    required: true,
    unique: true,
  },
  description: {
    type: String,
    trim: true,
  },
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
  }
};

export default OwlModel("Business", BusinessData);
