import dotenv from "dotenv";
dotenv.config();

export const config = {
  databaseUrl: process.env.DATABASE_URL || "postgresql://localhost:5432/restaurantos",
  port: Number(process.env.PORT || 4000),
  jwtSecret: process.env.JWT_SECRET || "dev-secret",
  frontendUrl: (process.env.FRONTEND_URL || "http://localhost:8080")
    .split(",")
    .map((url) => url.trim()),
};
