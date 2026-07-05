import jwt from "jsonwebtoken";

export interface ConsumerClaims {
  sub: string;
  scopes?: string[];
}

export function verifyConsumer(token: string, secret: string): ConsumerClaims {
  return jwt.verify(token, secret) as ConsumerClaims;
}

export function signConsumer(claims: ConsumerClaims, secret: string): string {
  return jwt.sign(claims, secret, { algorithm: "HS256", expiresIn: "12h" });
}
