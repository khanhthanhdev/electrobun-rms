import { validateUser, handleValidationError, ApiRequestSchema, UserSchema } from '../schemas';
import { safeValidate, formatErrors } from '../utils';

// Example 1: Strict validation (throws on error)
export function example1() {
  try {
    const user = validateUser({
      id: '1',
      email: 'test@example.com',
      name: 'John Doe',
      createdAt: new Date().toISOString(),
    });
    console.log('Valid user:', user);
  } catch (error) {
    console.error('Validation error:', handleValidationError(error));
  }
}

// Example 2: Safe validation (returns result object)
export function example2() {
  const result = safeValidate(
    UserSchema,
    {
      id: '1',
      email: 'invalid-email', // This will fail
      name: 'John Doe',
      createdAt: new Date().toISOString(),
    }
  );

  if (result.success) {
    console.log('Valid user:', result.data);
  } else {
    console.log('Errors:', formatErrors(result));
  }
}

// Example 3: API request validation
export function example3() {
  const apiData = {
    method: 'POST',
    endpoint: '/api/users',
    body: JSON.stringify({ name: 'Jane' }),
  };

  const result = safeValidate(
    ApiRequestSchema,
    apiData
  );

  if (result.success) {
    console.log('Valid API request:', result.data);
  } else {
    console.log('API validation failed:', formatErrors(result));
  }
}
