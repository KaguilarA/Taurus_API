import { randomBytes } from "node:crypto";
export const token = () => randomBytes(24).toString("hex");
