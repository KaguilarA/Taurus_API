import BaseController from "../../utils/baseController.js";
import exceptions from "../../utils/exceptions.js";

export default class extends BaseController {

  /**
   * Gets all states
   * @param {Object} req The request object.
   * @param {Object} res The response object.
   */
  async getAll(req, res) {
    try {
      const states = await this.model.find({}).select("-__v");

      res.status(200).json(states);
    } catch (err) {
      res.status(404).json({ message: err.message });
    }
  }

  /**
   * Gets all states for the business.
   * @param {Object} req The request object.
   * @param {Object} res The response object.
   *  @return {Promise<void>}|
   */
  async getBusinessStates(req, res) {
    try {
      const states = await this.model
        .find({ type: "business" })
        .select("-__v -type");
      res.status(200).json(states);
    } catch (err) {
      res.status(404).json({ message: err.message });
    }
  }

  /**
   * Gets all state for the cart.
   * @param {Object} req The request object.
   * @param {Object} res The response object.
   *  @return {Promise<void>}|
   */
  async getCartStates(req, res) {
    try {
      const states = await this.model
        .find({ type: "cart" })
        .select("-__v -type");
      res.status(200).json(states);
    } catch (err) {
      res.status(404).json({ message: err.message });
    }
  }

  /**
   * Gets all states for the menu items.
   * @param {Object} req The request object.
   * @param {Object} res The response object.
   * @return {Promise<void>}|
   */
  async getMenuItemsStates(req, res) {
    try {
      const states = await this.model
        .find({ type: "menu items" })
        .select("-__v -type");
      res.status(200).json(states);
    } catch (err) {
      res.status(404).json({ message: err.message });
    }
  }

  /**
   * Gets all states for the users.
   * @param {Object} req The request object.
   * @param {Object} res The response object.
   *  @return {Promise<void>}|
   */
  async getUsersStates(req, res) {
    try {
      const states = await this.model
        .find({ type: "users" })
        .select("-__v -type");
      res.status(200).json(states);
    } catch (err) {
      res.status(404).json({ message: err.message });
    }
  }

  /**
   * Register a new state.
   * @param {Object} req The request object.
   * @param {Object} res The response object.
   */
  register(req, res) {
    exceptions.register(this.model, req.body, res.status.bind(res));
  }
}