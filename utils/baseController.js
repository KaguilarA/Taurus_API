/**
 * BaseController class that provides common methods for interacting with the model.
 * Designed to be extended by specific controllers for CRUD operations using the model.
 */
export default class BaseController {
  model;

  /**
   * Constructor for the BaseModel class.
   * @param {any} model - The parameters for the model.
   */
  constructor(model) {
    this.model = model;
  }
}