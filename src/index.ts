import "dotenv/config";
import express from "express";
import type { Request, Response } from "express";
import { Prisma } from "./generated/prisma/client.js";
import { prisma } from "./lib/prisma.js";

const app = express();
const port = Number(process.env["PORT"]) || 3000;

app.use(express.json());

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.get("/users", async (_req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, username: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(users);
});

app.get("/users/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  if (typeof id !== "string") {
    res.status(400).json({ error: "Missing user id" });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, username: true, createdAt: true },
  });

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(user);
});

app.post("/users", async (req: Request, res: Response) => {
  const { email, username, password } = req.body ?? {};
  console.log(req.body);
  if (!email || !username || !password) {
    res
      .status(400)
      .json({ error: "email, username, and password are required" });
    return;
  }

  try {
    const user = await prisma.user.create({
      data: { email, username, password },
      select: { id: true, email: true, username: true, createdAt: true },
    });
    res.status(201).json(user);
  } catch (err) {
    console.error("ERROR: ", err);
    throw err;
  }
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
