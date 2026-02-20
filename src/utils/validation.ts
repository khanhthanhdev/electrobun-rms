import { parse, ValiError, type BaseIssue, type BaseSchema } from "valibot";

export type ValidationResult<T> =
	| { success: true; data: T }
	| { success: false; errors: string[] };

/**
 * Safely validate data against a schema
 * @param schema Valibot schema
 * @param data Data to validate
 * @returns Result with success status and data or errors
 */
export function safeValidate<T>(
	schema: BaseSchema<unknown, T, BaseIssue<unknown>>,
	data: unknown,
): ValidationResult<T> {
	try {
		const result = parse(schema, data);
		return { success: true, data: result };
	} catch (error) {
		if (error instanceof ValiError) {
			const errors = error.issues.map((issue) => issue.message);
			return { success: false, errors };
		}
		return { success: false, errors: ["Unknown validation error"] };
	}
}

/**
 * Get first error message from validation result
 */
export function getFirstError(result: ValidationResult<unknown>): string | null {
	return result.success ? null : (result.errors[0] ?? null);
}

/**
 * Format all validation errors
 */
export function formatErrors(result: ValidationResult<unknown>): string {
	return result.success ? "" : result.errors.join("; ");
}
