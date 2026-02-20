import { useEffect, useMemo, useState, type FormEvent } from "react";

interface UserRole {
	role: string;
	event: string;
}

interface AuthUser {
	username: string;
	type: number;
	roles: UserRole[];
}

const API_BASE = "/api";
const TOKEN_STORAGE_KEY = "rtms_auth_token";

function App() {
	const [username, setUsername] = useState("admin");
	const [password, setPassword] = useState("admin1234");
	const [token, setToken] = useState<string | null>(() =>
		localStorage.getItem(TOKEN_STORAGE_KEY),
	);
	const [user, setUser] = useState<AuthUser | null>(null);
	const [loading, setLoading] = useState(true);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;

		async function loadCurrentUser(): Promise<void> {
			if (!token) {
				if (!cancelled) {
					setUser(null);
					setLoading(false);
				}
				return;
			}

			try {
				const res = await fetch(`${API_BASE}/auth/me`, {
					headers: { Authorization: `Bearer ${token}` },
				});

				if (!res.ok) {
					throw new Error("Session expired");
				}

				const data = (await res.json()) as { user: AuthUser };
				if (!cancelled) {
					setUser(data.user);
					setError(null);
				}
			} catch {
				localStorage.removeItem(TOKEN_STORAGE_KEY);
				if (!cancelled) {
					setToken(null);
					setUser(null);
					setError("Please log in.");
				}
			} finally {
				if (!cancelled) {
					setLoading(false);
				}
			}
		}

		void loadCurrentUser();

		return () => {
			cancelled = true;
		};
	}, [token]);

	const roleSummary = useMemo(() => {
		if (!user) return "";
		return user.roles.map((item) => `${item.role}@${item.event}`).join(", ");
	}, [user]);

	const handleLogin = async (event: FormEvent): Promise<void> => {
		event.preventDefault();
		setSubmitting(true);
		setError(null);

		try {
			const res = await fetch(`${API_BASE}/auth/login`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ username, password }),
			});

			const data = (await res.json()) as
				| { token: string; user: AuthUser }
				| { error?: string; message?: string };

			if (!res.ok || !("token" in data)) {
				const message =
					("message" in data && data.message) ||
					("error" in data && data.error) ||
					"Unable to log in.";
				throw new Error(message);
			}

			localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
			setToken(data.token);
			setUser(data.user);
			setPassword("");
		} catch (loginError) {
			setError(
				loginError instanceof Error ? loginError.message : "Unable to log in.",
			);
		} finally {
			setSubmitting(false);
		}
	};

	const handleLogout = async (): Promise<void> => {
		if (token) {
			await fetch(`${API_BASE}/auth/logout`, {
				method: "POST",
				headers: { Authorization: `Bearer ${token}` },
			});
		}

		localStorage.removeItem(TOKEN_STORAGE_KEY);
		setToken(null);
		setUser(null);
		setPassword("admin1234");
		setError(null);
	};

	return (
		<div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
			<div className="mx-auto flex min-h-screen max-w-3xl items-center px-4 py-10">
				<div className="w-full rounded-2xl border border-slate-700/60 bg-slate-900/70 p-6 shadow-2xl backdrop-blur">
					<header className="mb-8 text-center">
						<h1 className="text-3xl font-bold tracking-tight">
							Robotics Tournament Management
						</h1>
						<p className="mt-2 text-sm text-slate-400">Server authentication console</p>
					</header>

					{error && (
						<div className="mb-5 rounded-lg border border-red-500/50 bg-red-500/20 px-4 py-3 text-sm text-red-200">
							{error}
						</div>
					)}

					{loading ? (
						<p className="py-8 text-center text-slate-400">Checking session...</p>
					) : user ? (
						<div className="space-y-5">
							<div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4">
								<p className="text-sm text-emerald-300">Authenticated</p>
								<p className="mt-1 text-lg font-semibold">{user.username}</p>
								<p className="mt-1 text-sm text-slate-300">Type: {user.type}</p>
								<p className="mt-1 text-sm text-slate-300">
									Roles: {roleSummary || "No roles assigned"}
								</p>
							</div>
							<button
								type="button"
								onClick={() => void handleLogout()}
								className="w-full rounded-lg bg-slate-700 px-4 py-3 font-medium text-white transition hover:bg-slate-600"
							>
								Log out
							</button>
						</div>
					) : (
						<form className="space-y-4" onSubmit={(event) => void handleLogin(event)}>
							<div>
								<label className="mb-1 block text-sm text-slate-300" htmlFor="username">
									Username
								</label>
								<input
									id="username"
									type="text"
									value={username}
									onChange={(event) => setUsername(event.target.value)}
									autoComplete="username"
									className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-3 text-white placeholder-slate-400 outline-none focus:border-sky-500"
									placeholder="Enter username"
								/>
							</div>

							<div>
								<label className="mb-1 block text-sm text-slate-300" htmlFor="password">
									Password
								</label>
								<input
									id="password"
									type="password"
									value={password}
									onChange={(event) => setPassword(event.target.value)}
									autoComplete="current-password"
									className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-3 text-white placeholder-slate-400 outline-none focus:border-sky-500"
									placeholder="Enter password"
								/>
							</div>

							<button
								type="submit"
								disabled={submitting}
								className="w-full rounded-lg bg-sky-600 px-4 py-3 font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-70"
							>
								{submitting ? "Signing in..." : "Sign in"}
							</button>
						</form>
					)}
				</div>
			</div>
		</div>
	);
}

export default App;
