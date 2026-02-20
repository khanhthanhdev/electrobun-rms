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
    <main className="page-shell page-shell--center">
      <form
        className="card surface-card surface-card--small stack"
        method="post"
        onSubmit={handleSubmit}
      >
        <header>
          <h3 className="app-heading app-heading--center">Sign in</h3>
          <p className="app-subheading app-subheading--center">
            Enter your credentials to continue.
          </p>
        </header>

        {errorMessage ? (
          <p className="message-block" data-variant="danger" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <div className="stack stack--compact">
          <div className="form-row" data-field>
            <label htmlFor="username">Username</label>
            <input
              autoComplete="username"
              id="username"
              onChange={(event) => {
                setUsername(event.target.value);
              }}
              placeholder="Enter username"
              type="text"
              value={username}
            />
          </div>

          <div className="form-row" data-field>
            <label htmlFor="password">Password</label>
            <input
              autoComplete="current-password"
              id="password"
              onChange={(event) => {
                setPassword(event.target.value);
              }}
              placeholder="Enter password"
              type={showPassword ? "text" : "password"}
              value={password}
            />
          </div>

          <label className="form-checkbox" htmlFor="showPassword">
            <input
              checked={showPassword}
              id="showPassword"
              onChange={(event) => {
                setShowPassword(event.target.checked);
              }}
              type="checkbox"
            />
            Show password
          </label>
        </div>

        <button className="form-submit" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
};
