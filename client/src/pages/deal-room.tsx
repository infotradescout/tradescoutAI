import React, { useEffect, useMemo } from "react";
import { useLocation, useRoute } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DealRoomPanel } from "@/components/jobs/DealRoomPanel";
import type { DealRoomRole } from "@/lib/dealRoomState";
import { ArrowLeft, MessageCircle, FileText } from "lucide-react";

function getDealRoomRole(user: any): DealRoomRole {
	if (!user) return "guest";
	const roles: string[] = Array.isArray(user.roles) && user.roles.length
		? (user.roles as string[])
		: user.role
		? [String(user.role)]
		: [];
	const baseRoles = Array.from(new Set(roles.map((r) => r.split(":")[0].toLowerCase())));
	if (
		baseRoles.includes("contractor") ||
		baseRoles.includes("pro") ||
		baseRoles.includes("service_provider")
	) {
		return "contractor";
	}
	if (baseRoles.includes("homeowner")) {
		return "homeowner";
	}
	return "guest";
}

export default function DealRoomPage() {
	const { user, isAuthenticated } = useAuth();
	const role = useMemo(() => getDealRoomRole(user), [user]);
	const [location, navigate] = useLocation();
	const [match, params] = useRoute("/deal-room/:jobId");

	let jobId: string | null = match ? ((params as any).jobId as string) : null;
	if (!jobId && location.includes("?")) {
		const [, search] = location.split("?");
		if (search) {
			const qs = new URLSearchParams(search);
			const fromQuery = qs.get("jobId") || qs.get("projectId");
			if (fromQuery) {
				jobId = fromQuery;
			}
		}
	}

	useEffect(() => {
		if (typeof document !== "undefined") {
			document.title = "Deal Room | TradeScout";
		}
	}, []);

	// ProtectedRoute already guards unauthenticated access, but keep a soft fallback.
	if (!isAuthenticated) {
		return (
			<div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
				<Card className="bg-slate-900 border-slate-800 max-w-md w-full">
					<CardContent className="p-6 text-center space-y-4">
						<p className="text-sm text-slate-100 font-semibold">Sign in required</p>
						<p className="text-xs text-slate-400">
							You need to be signed in to open a job deal room.
						</p>
						<Button size="sm" className="mt-2" onClick={() => navigate("/login")}>
							Go to login
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	const handleBackToFinances = () => {
		if (jobId) {
			navigate(`/finances?jobId=${encodeURIComponent(jobId)}`);
			return;
		}
		navigate("/finances");
	};

	const handleOpenMessages = () => {
		navigate("/messages");
	};

	const handleOpenChat = () => {
		navigate("/chat");
	};

	return (
		<div className="min-h-[calc(100vh-4rem)] px-3 sm:px-4 md:px-6 lg:px-8 py-4 md:py-6 flex flex-col gap-4 max-w-6xl mx-auto">
			<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
				<div className="space-y-1">
					<div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
						<FileText className="h-3 w-3" />
						<span>Deal room</span>
					</div>
					<h1 className="text-xl md:text-2xl font-semibold text-white">
						Project workspace
					</h1>
					<p className="text-xs md:text-sm text-slate-400 max-w-xl">
						Scout keeps the full job lifecycle here: materials, estimates, contracts, invoices,
						and receipts for a single project.
					</p>
					{jobId && (
						<p className="text-[11px] text-slate-500">Job ID: {jobId}</p>
					)}
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						className="h-8 px-3 border-slate-600 text-[11px] text-slate-200"
						onClick={handleBackToFinances}
					>
						<ArrowLeft className="h-3 w-3 mr-1" />
						Back to finances
					</Button>
					<Button
						variant="outline"
						size="sm"
						className="h-8 px-3 border-slate-600 text-[11px] text-slate-200"
						onClick={handleOpenMessages}
					>
						<MessageCircle className="h-3 w-3 mr-1" />
						Open messages
					</Button>
					<Button
						variant="outline"
						size="sm"
						className="h-8 px-3 border-slate-600 text-[11px] text-slate-200"
						onClick={handleOpenChat}
					>
						<MessageCircle className="h-3 w-3 mr-1" />
						Legacy chat
					</Button>
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1.1fr)] gap-4 lg:gap-6 items-start">
				<Card className="bg-slate-900/40 border-slate-800/80 h-full">
					<CardContent className="p-3 sm:p-4 h-full">
						<DealRoomPanel jobId={jobId} userRole={role} />
					</CardContent>
				</Card>

				<Card className="bg-slate-900/60 border-slate-800/90">
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-semibold text-white">How this room works</CardTitle>
						<CardDescription className="text-xs text-slate-400">
							Scout treats this as the command center for a single job.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-3 text-[11px] text-slate-300">
						<ul className="space-y-2 list-disc list-inside">
							<li>
								Start with a material list or estimate, then move into contracts,
									invoices, and receipts.
							</li>
							<li>
								When you approve, send, sign, or mark things paid here, Scout updates
									your finances workspace automatically.
							</li>
							<li>
								Use Messages or chat from the header to keep all discussion tied to
									this project.
							</li>
						</ul>
						{!jobId && (
							<p className="pt-2 text-[11px] text-amber-300/90">
								No job ID was provided. You can still use this room for standalone
									accounting, but linking it to a job will unlock more automation later.
							</p>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
