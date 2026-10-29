import type { Request } from "express";
import type { AuthenticatedUser } from "./authenticated-user.type.js";

export type RequestWithUser = Request & {
    user?: AuthenticatedUser;
};