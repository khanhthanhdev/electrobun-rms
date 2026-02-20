import {
	number,
	object,
	optional,
	parse,
	pipe,
	string,
	minLength,
	ValiError,
	type InferOutput,
} from "valibot";

// API Request schema
export const ApiRequestSchema = object({
	method: pipe(string(), minLength(1, "Method is required")),
	endpoint: pipe(string(), minLength(1, "Endpoint is required")),
	body: optional(string()),
	headers: optional(object({})),
});

export type ApiRequest = InferOutput<typeof ApiRequestSchema>;

// API Response schema
export const ApiResponseSchema = object({
	status: number(),
	data: optional(object({})),
	error: optional(string()),
});

export type ApiResponse = InferOutput<typeof ApiResponseSchema>;

export function validateApiRequest(data: unknown): ApiRequest {
	return parse(ApiRequestSchema, data);
}

export function validateApiResponse(data: unknown): ApiResponse {
	return parse(ApiResponseSchema, data);
}

export function handleValidationError(error: unknown): string {
	if (error instanceof ValiError) {
		return error.issues.map((issue) => issue.message).join(", ");
	}
	return "Unknown validation error";
}
