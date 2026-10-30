const model = {
  sampleKey: { type: String, unique: true, sparse: true },
  title: { type: String, required: true },
  kind: {
    type: String,
    enum: ["music", "karaoke", "sports", "other"],
    default: "other",
  },
  description: String,
  image: String,
  starts: { type: Date, default: null },
  ends: { type: Date, default: null },
  location: String,
  admission: String,
  active: { type: Boolean, default: true },
  isSample: { type: Boolean, default: false },
};
export const ModelName = "Event";
export default { name: ModelName, model };
