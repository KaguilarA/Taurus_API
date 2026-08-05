import TaurusModel from "./../utils/model.js";

export default TaurusModel("Business", {
  name: {
    type: String,
    required: true,
    unique: true,
  },
  description: {
    type: String,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  phone: {
    type: String,
    required: true,
    trim: true,
  },
  imagesBaseUrl: {
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
  },
});
