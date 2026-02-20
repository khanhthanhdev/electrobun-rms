import { Hono } from "hono";
import { db, schema } from "../db";
import { eq } from "drizzle-orm";

const api = new Hono();

// Get all todos
api.get("/todos", async (c) => {
  const todos = await db.select().from(schema.todos).all();
  return c.json(todos);
});

// Create a todo
api.post("/todos", async (c) => {
  const body = await c.req.json<{ title: string }>();
  const result = await db.insert(schema.todos).values({ title: body.title }).returning();
  return c.json(result[0], 201);
});

// Toggle todo completion
api.patch("/todos/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await c.req.json<{ completed?: boolean; title?: string }>();

  const updates: Record<string, unknown> = {};
  if (body.completed !== undefined) updates.completed = body.completed;
  if (body.title !== undefined) updates.title = body.title;

  const result = await db
    .update(schema.todos)
    .set(updates)
    .where(eq(schema.todos.id, id))
    .returning();

  if (result.length === 0) return c.json({ error: "Not found" }, 404);
  return c.json(result[0]);
});

// Delete a todo
api.delete("/todos/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const result = await db
    .delete(schema.todos)
    .where(eq(schema.todos.id, id))
    .returning();

  if (result.length === 0) return c.json({ error: "Not found" }, 404);
  return c.json({ deleted: true });
});

export { api };
