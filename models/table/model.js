const model = {
  name: { type: String, required: true },
  token: { type: String, required: true, unique: true },
  active: { type: Boolean, default: true },
};
export const ModelName = "Table";
export default { name: ModelName, model };
