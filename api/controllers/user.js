import BaseController from '../../utils/baseController.js';
import exceptions from "../../utils/exceptions.js";

export default class extends BaseController {

  /**
   * Activates a user.
   * @param {Object} req The request object.
   * @param {Object} res The response object.
   */
  activateUser = async (req, res) => {
    try {
      const { id } = req.params;
      console.log('Activating user with ID:', id);
      // if (!id) res.status(400).json({ message: 'User ID is required' });
      // const user = await this.model.updateState(+id, true);
      // res.status(200).json(user);
    } catch (err) {
      res.status(404).json({ message: err.message });
    }
  }

  /**
   * Creates a new user.
   * @param {Object} req The request object.
   * @param {Object} res The response object.
   */
  register(req, res) {
    exceptions.register(this.model, req.body, res.status.bind(res));
  }

  /**
   * Disables a user.
   * @param {Object} req The request object.
   * @param {Object} res The response object.
   */
  disableUser = async (req, res) => {
    try {
      const { id } = req.params;
      console.log('Disabling user with ID:', id);
      // if (!id) res.status(400).json({ message: 'User ID is required' });
      // const user = await this.model.updateState(+id, false);
      // res.status(200).json(user);
    } catch (err) {
      res.status(404).json({ message: err.message });
    }
  }

  /**
   * Gets all users.
   * @param {Object} req The request object.
   * @param {Object} res The response object.
   */
  async getAll(req, res) {
    try {
      const users = await this.model
        .find({}, "-__v -permission_list -password_hash -createdAt -updatedAt")
        .populate("state", "-__v -type")
        .lean();

      res.status(200).json(users);
    } catch (err) {
      res.status(404).json({ message: err.message });
    }
  }

  /**
   * Gets all active users.
   * @param {Object} req The request object.
   * @param {Object} res The response object.
   */
  getActive = async (req, res) => {
    try {
      const users = await this.model.find({ state: 'active' });

      console.log(users);
      // const users = await this.model.getByState(true);
      // res.status(200).json(users);
    } catch (err) {
      res.status(404).json({ message: err.message });
    }
  }

  /**
   * Gets all disabled users.
   * @param {Object} req The request object.
   * @param {Object} res The response object.
   */
  getDisabled = async (req, res) => {
    try {
      // const users = await this.model.getByState(false);
      // res.status(200).json(users);
    } catch (err) {
      res.status(404).json({ message: err.message });
    }
  }

  /**
   * Gets a user by ID.
   * @param {Object} req The request object.
   * @param {Object} res The response object.
   */
  getById = async (req, res) => {
    try {
      const { id } = req.params;
      console.log('Getting user with ID:', id);
      // if (!id) res.status(400).json({ message: 'User ID is required' });
      // const user = await this.model.getById(+id);
      // res.status(200).json(user);
    } catch (err) {
      res.status(404).json({ message: err.message });
    }
  }

  /**
   * Updates a user.
   * @param {Object} req The request object.
   * @param {Object} res The response object.
   */
  updateUser = async (req, res) => {
    try {
      const user = req.body;
      const { id } = req.params;
      console.log('Updating user with ID:', id, 'Data:', user);
      // if (!id) res.status(400).json({ message: 'User ID is required' });
      // const updatedUser = await this.model.update({ ...user, id: +id });
      // res.status(200).json(updatedUser);
    } catch (err) {
      res.status(404).json({ message: err.message });
    }
  }

  /**
   * Updates a user's password.
   * @param {Object} req The request object.
   * @param {Object} res The response object.
   */
  updatePassword = async (req, res) => {
    try {
      const { username, password } = req.body;
      console.log('Updating password for user:', username);
      // if (!username || !password) res.status(400).json({ message: 'Username and password are required' });
      // const updatedUser = await this.model.updatePassword(username, password);
      // res.status(200).json(updatedUser);
    } catch (err) {
      res.status(404).json({ message: err.message });
    }
  }

  /**
   * Validates a user's password.
   * @param {Object} req The request object.
   * @param {Object} res The response object.
   */
  validatePassword = async (req, res) => {
    try {
      const { username, password } = req.body;
      console.log('Validating password for user:', username);
      // const isValid = await this.model.validatePassword(username, password);
      // res.status(200).json(isValid);

      res.setHeader('Set-Cookie', 'loggedIn=true');
    } catch (err) {
      res.status(404).json({ message: err.message });
    }
  }
}