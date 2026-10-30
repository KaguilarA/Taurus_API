import BaseController from "../../utils/baseController.js";

export default class extends BaseController {

  /**
   * Get all permissions
   * @param {Object} req The request object
   * @param {Object} res The response object
   * @returns {Promise<void>}
   */
  getAll = async (req, res) => {
    try {
      const models = await this.model.find({});
      res.status(200).json(models);
    } catch (err) {
      res.status(404).json({ message: err.message });
    }
  };

  /**
   * Register a new permission
   * @param {Object} req The request object
   * @param {Object} res The response object
   * @return {Promise<void>}
   */
  register = async (req, res) => {
    try {
      const newModel = new this.model({ ...req.body });
      const registeredModel = await newModel.save();

      res.status(201).json(registeredModel);
    } catch (err) {
      res.status(409).json({ message: err.message });
    }
  };
}