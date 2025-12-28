import { useEffect } from "react";
import { useLocation } from "wouter";

// Legacy route: /lead-management
// Projects and deal rooms now live inside the Finances workspace.
// This page simply forwards users (and any jobId/projectId query params)
// into /finances.

export default function ProjectTracker() {
	const [location, navigate] = useLocation();

	useEffect(() => {
		try {
			const parts = location.split("?");
			const search = parts[1] ? `?${parts[1]}` : "";
			navigate(`/finances${search}`);
		} catch {
			navigate("/finances");
		}
	}, [location, navigate]);

	return (
		<div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-200 px-4">
			<div className="max-w-md text-center space-y-2">
				<h1 className="text-base font-semibold">Projects moved to Finances</h1>
				<p className="text-xs text-slate-400">
					Your jobs and deal workflow now live in your Finances workspace. We're sending you there
					automatically.
				</p>
			</div>
		</div>
	);
}
