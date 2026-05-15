import {
  array,
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

export const updateStatusBodySchema = object({
  status: picklist(["IN_PROGRESS", "INCOMPLETE", "PASSED"]),
});

export const saveCommentBodySchema = object({
  comment: pipe(string(), maxLength(2000)),
});

export const overrideStatusBodySchema = object({
  comment: pipe(string(), maxLength(2000)),
});
