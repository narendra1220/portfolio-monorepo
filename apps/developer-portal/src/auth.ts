import jwt from "jsonwebtoken";

export interface AuthClaims {
  sub: string;
  role: "admin" | "editor" | "viewer";
  teams?: string[];
}

export function signToken(claims: AuthClaims, secret: string): string {
  return jwt.sign(claims, secret, { algorithm: "HS256", expiresIn: "12h" });
}

export function verifyToken(token: string, secret: string): AuthClaims {
  return jwt.verify(token, secret) as AuthClaims;
}
