export default {
  register: async (model, initData, status) => {
    try {
      const newModel = new model({ ...initData });
      const registeredModel = await newModel.save();

      status(201).json({
        message: "Registration successful",
        data: registeredModel
      });
    } catch (err) {
      status(409).json({ message: err.message });
    }
  }
}