import { type FormEvent, useState } from "react";
import type { LoginCredentials } from "../../../shared/types/auth";

interface LoginFormProps {
  errorMessage: string | null;
  isSubmitting: boolean;
  onSubmit: (credentials: LoginCredentials) => Promise<boolean>;
}

export const LoginForm = ({
  errorMessage,
  isSubmitting,
  onSubmit,
}: LoginFormProps): JSX.Element => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    onSubmit({
      password,
      username,
    }).then((wasSuccessful) => {
      if (wasSuccessful) {
        setUsername("");
        setPassword("");
      }
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <form
        className="w-full max-w-sm space-y-6 rounded-lg bg-white p-8 shadow-md"
        method="post"
        onSubmit={handleSubmit}
      >
        <div>
          <h3 className="text-center font-bold text-gray-900 text-xl">
            Sign in
          </h3>
          <p className="mt-2 text-center text-gray-600 text-sm">
            Enter your credentials to continue.
          </p>
        </div>

        {errorMessage ? (
          <div className="rounded-md bg-red-50 p-3 text-red-700 text-sm">
            {errorMessage}
          </div>
        ) : null}

        <div className="space-y-4">
          <div>
            <label
              className="block font-semibold text-gray-900 text-sm"
              htmlFor="username"
            >
              Username
            </label>
            <input
              autoComplete="username"
              className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              id="username"
              onChange={(event) => {
                setUsername(event.target.value);
              }}
              placeholder="Enter username"
              type="text"
              value={username}
            />
          </div>

          <div>
            <label
              className="block font-semibold text-gray-900 text-sm"
              htmlFor="password"
            >
              Password
            </label>
            <input
              autoComplete="current-password"
              className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              id="password"
              onChange={(event) => {
                setPassword(event.target.value);
              }}
              placeholder="Enter password"
              type={showPassword ? "text" : "password"}
              value={password}
            />
          </div>

          <div className="flex items-center">
            <input
              checked={showPassword}
              className="h-4 w-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
              id="showPassword"
              onChange={(event) => {
                setShowPassword(event.target.checked);
              }}
              type="checkbox"
            />
            <label
              className="ml-2 text-gray-700 text-sm"
              htmlFor="showPassword"
            >
              Show password
            </label>
          </div>
        </div>

        <button
          className="w-full rounded-md bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
};
