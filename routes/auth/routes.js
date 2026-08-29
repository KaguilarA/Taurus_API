import { Router } from "express";
import AuthController from "../../controllers/auth/controller.js";

/**
 * Create the authentication router.
 * @param {Object} data - Configuration data for the router.
 * @returns {import('express').Router}
 */
export default (data) => {
  const router = Router();
  const { logIn, logout, status } = AuthController(data);

  router.post("/login", logIn);
  router.post("/logout", logout);
  router.get("/status", status);

  return router;
};
