import TaurusModel from "./../utils/model.js";

export default TaurusModel("State", {
  name: {
    type: String,
    required: true,
    unique: true,
  },
  type: [
    {
      type: String,
      enum: ["users", "business", "menu items", "cart"],
      required: true,
    },
  ],
});