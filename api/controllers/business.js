import BaseController from "../../utils/baseController.js";
import exceptions from "../../utils/exceptions.js";

export default class extends BaseController {

  /**
   * Register a new business.
   * @param {Object} req The request object.
   * @param {Object} res The response object.
   */
  register(req, res) {
    exceptions.register(this.model, req.body, res.status.bind(res));
  }

  /**
   * Get business information by ID.
   * @param {Object} req The request object.
   * @param {Object} res The response object.
   */
  async getBusinessInfo(req, res) {
    try {
      const { businessId } = req.params;

      if (!businessId) {
        return res.status(400).json({ error: "Business ID is required" });
      }

      const business = await this.model.findById(businessId)
        .populate("state")
        .populate("users");
      
      if (!business) {
        return res.status(404).json({ error: "Business not found" });
      }

      return res.status(200).json(business);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
}