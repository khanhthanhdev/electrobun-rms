import {
  array,
  type InferOutput,
  maxLength,
  minLength,
  nullable,
  object,
  picklist,
  pipe,
  string,
} from "valibot";

export const updateItemsBodySchema = object({
  items: array(
    object({
      key: pipe(string(), minLength(1), maxLength(128)),
      value: nullable(string()),
    })
  ),
});

export type UpdateItemsBody = InferOutput<typeof updateItemsBodySchema>;

export const updateStatusBodySchema = object({
  status: picklist(["IN_PROGRESS", "INCOMPLETE", "PASSED"]),
});

export type UpdateStatusBody = InferOutput<typeof updateStatusBodySchema>;

export const saveCommentBodySchema = object({
  comment: pipe(string(), maxLength(2000)),
});

export type SaveCommentBody = InferOutput<typeof saveCommentBodySchema>;

export const overrideStatusBodySchema = object({
  comment: pipe(string(), maxLength(2000)),
});

export type OverrideStatusBody = InferOutput<typeof overrideStatusBodySchema>;
