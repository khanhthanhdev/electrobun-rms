const jwtSecret =
  process.env.JWT_SECRET || "jwt_secret_key_change_me_in_production";

if (!jwtSecret) {
  throw new Error("JWT_SECRET environment variable is required");
}

export const JWT_SECRET_KEY = jwtSecret;
export const TOKEN_TTL_SECONDS = 12 * 60 * 60;
