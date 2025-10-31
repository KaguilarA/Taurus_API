import BaseController from '../../utils/baseController.js';
import exceptions from '../../utils/exceptions.js';

export default class extends BaseController {

  /**
   * Activates a product.
   * @param {Object} req The request object.
   * @param {Object} res The response object.
   */
  activateProduct = async (req, res) => {
    try {
      const { id } = req.params;
      if (!id) res.status(400).json({ message: 'Product ID is required' });
      const product = await this.model.updateState(parseInt(id), true);
      res.status(200).json(product);
    } catch (err) {
      res.status(404).json({ message: err.message });
    }
  }

  /**
   * Creates a new product.
   * @param {Object} req The request object.
   * @param {Object} res The response object.
   */
  createProduct = async (req, res) => {
    try {
      const product = req.body;
      if (!product.name || !product.type || !product.imageUrl || !product.stock || !product.price) {
        res.status(400).json({ message: 'All product fields are required' });
      }
      const newProduct = await this.model.register(product);
      res.status(201).json(newProduct);
    } catch (err) {
      res.status(409).json({ message: err.message });
    }
  }

  /**
   * Disables a product.
   * @param {Object} req The request object.
   * @param {Object} res The response object.
   */
  disableProduct = async (req, res) => {
    try {
      const { id } = req.params;
      if (!id) res.status(400).json({ message: 'Product ID is required' });
      const product = await this.model.updateState(parseInt(id), false);
      res.status(200).json(product);
    } catch (err) {
      res.status(404).json({ message: err.message });
    }
  }

  /**
 * Gets all products.
 * @param {Object} req The request object.
 * @param {Object} res The response object.
 */
  getAllProducts = async (req, res) => {
    try {
      const products = await this.model.getAll();
      res.status(200).json(products);
    } catch (err) {
      res.status(404).json({ message: err.message });
    }
  }

  /**
   * Gets a product by ID.
   * @param {Object} req The request object.
   * @param {Object} res The response object.
   */
  getProductById = async (req, res) => {
    try {
      const { id } = req.params;
      // if (!id) return res.status(400).json({ message: 'Product ID is required' });
      // const product = await this.model.getById(parseInt(id));
      res.status(200).json({hi: true});
    } catch (err) {
      res.status(404).json({ message: err.message });
    }
  }

  /**
   * Gets products by type.
   * @param {Object} req The request object.
   * @param {Object} res The response object.
   */
  getTypes = async (req, res) => {
    try {
      const products = await this.model[1].find({}, '-__v');

      res.status(200).json(products);
    } catch (err) {
      res.status(404).json({ message: err.message });
    }
  }

  /**
   * Creates a new product type.
   * @param {Object} req The request object.
   * @param {Object} res The response object.
   */
  registerType(req, res) {
    exceptions.register(this.model[1], req.body, res.status.bind(res));
  }

  /**
   * Updates a product.
   * @param {Object} req The request object.
   * @param {Object} res The response object.
   */
  updateProduct = async (req, res) => {
    try {
      const product = req.body;
      if (!product.id) res.status(400).json({ message: 'Product ID is required' });
      const updatedProduct = await this.model.update(product);
      res.status(200).json(updatedProduct);
    } catch (err) {
      res.status(404).json({ message: err.message });
    }
  }

  /**
   * Updates the stock of a product.
   * @param {Object} req The request object.
   * @param {Object} res The response object.
   */
  updateProductStock = async (req, res) => {
    try {
      const { id, stock } = req.body;
      if (!id || !stock) res.status(400).json({ message: 'Product ID and stock are required' });
      const product = await this.model.updateStock(parseInt(id), parseInt(stock));
      res.status(200).json(product);
    } catch (err) {
      res.status(404).json({ message: err.message });
    }
  }
}