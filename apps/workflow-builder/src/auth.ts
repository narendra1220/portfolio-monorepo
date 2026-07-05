import jwt, { type JwtPayload } from "jsonwebtoken";

export interface Principal {
  sub: string;
  name?: string;
}

export function signToken(secret: string, p: Principal, ttlSec = 3600): string {
  return jwt.sign(p, secret, { algorithm: "HS256", expiresIn: ttlSec });
}

export function verifyToken(secret: string, token: string): Principal {
  const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] }) as
    | JwtPayload
    | string;
  if (typeof decoded === "string" || !decoded.sub) {
    throw new Error("invalid token");
  }
  return {
    sub: String(decoded.sub),
    name: typeof decoded.name === "string" ? decoded.name : undefined,
  };
}
