import { useState, useEffect, useCallback } from "react";

interface Todo {
	id: number;
	title: string;
	completed: boolean;
	created_at: string;
}

const API_BASE = "/api";

function App() {
	const [todos, setTodos] = useState<Todo[]>([]);
	const [newTitle, setNewTitle] = useState("");
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchTodos = useCallback(async () => {
		try {
			const res = await fetch(`${API_BASE}/todos`);
			const data = await res.json();
			setTodos(data);
			setError(null);
		} catch {
			setError("Failed to connect to server");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchTodos();
	}, [fetchTodos]);

	const addTodo = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!newTitle.trim()) return;
		const res = await fetch(`${API_BASE}/todos`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ title: newTitle.trim() }),
		});
		const todo = await res.json();
		setTodos((prev) => [...prev, todo]);
		setNewTitle("");
	};

	const toggleTodo = async (todo: Todo) => {
		const res = await fetch(`${API_BASE}/todos/${todo.id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ completed: !todo.completed }),
		});
		const updated = await res.json();
		setTodos((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
	};

	const deleteTodo = async (id: number) => {
		await fetch(`${API_BASE}/todos/${id}`, { method: "DELETE" });
		setTodos((prev) => prev.filter((t) => t.id !== id));
	};

	const completedCount = todos.filter((t) => t.completed).length;

	return (
		<div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white">
			<div className="container mx-auto px-4 py-10 max-w-2xl">
				<header className="text-center mb-10">
					<h1 className="text-4xl font-bold mb-2">📋 Todo App</h1>
					<p className="text-slate-400">
						ElectroBun + Hono + Drizzle + bun:sqlite
					</p>
					<p className="text-sm text-slate-500 mt-1">
						Accessible from LAN at{" "}
						<code className="bg-slate-700 px-2 py-0.5 rounded">
							http://&lt;your-ip&gt;:3000
						</code>
					</p>
				</header>

				{error && (
					<div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6 text-red-300">
						{error}
					</div>
				)}

				<form onSubmit={addTodo} className="flex gap-3 mb-8">
					<input
						type="text"
						value={newTitle}
						onChange={(e) => setNewTitle(e.target.value)}
						placeholder="What needs to be done?"
						className="flex-1 px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
					/>
					<button
						type="submit"
						className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
					>
						Add
					</button>
				</form>

				{loading ? (
					<div className="text-center text-slate-400 py-10">Loading...</div>
				) : todos.length === 0 ? (
					<div className="text-center text-slate-500 py-10">
						<p className="text-5xl mb-4">🎉</p>
						<p>No todos yet. Add one above!</p>
					</div>
				) : (
					<>
						<div className="text-sm text-slate-400 mb-4">
							{completedCount}/{todos.length} completed
						</div>
						<ul className="space-y-2">
							{todos.map((todo) => (
								<li
									key={todo.id}
									className="flex items-center gap-3 bg-slate-700/30 border border-slate-600/50 rounded-lg px-4 py-3 group"
								>
									<button
										onClick={() => toggleTodo(todo)}
										className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
											todo.completed
												? "bg-green-500 border-green-500 text-white"
												: "border-slate-500 hover:border-blue-500"
										}`}
									>
										{todo.completed && "✓"}
									</button>
									<span
										className={`flex-1 ${
											todo.completed
												? "line-through text-slate-500"
												: "text-white"
										}`}
									>
										{todo.title}
									</span>
									<button
										onClick={() => deleteTodo(todo.id)}
										className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
									>
										✕
									</button>
								</li>
							))}
						</ul>
					</>
				)}

				<footer className="mt-12 text-center text-slate-600 text-sm">
					<div className="flex justify-center gap-4">
						<span>⚡ ElectroBun</span>
						<span>🔥 Hono</span>
						<span>💾 Drizzle + SQLite</span>
						<span>⚛️ React</span>
					</div>
				</footer>
			</div>
		</div>
	);
}

export default App;
