import { OwlModel } from "owl-expressjs-utils";

const PromoData = {
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: [150, "Promo name cannot exceed 150 characters"],
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, "Promo description cannot exceed 500 characters"],
  },
  date: {
    type: Date,
    index: true,
  },
  state: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "State",
    required: true,
  },
  productMaxCount: {
    type: Number,
    default: 1,
  },
};

export default OwlModel("Promo", PromoData);
