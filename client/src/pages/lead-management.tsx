import { memo, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Phone, Mail, MapPin, Calendar, Search, Wrench } from "lucide-react";
import { getStatusColorClass } from "@/lib/colors";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { DealRoomPanel } from "@/components/jobs/DealRoomPanel";
import type { DealRoomRole } from "@/lib/dealRoomState";
import { getUserLocationLabel } from "@/lib/copyHelpers";
import { useLocation } from "wouter";

interface DashboardProject {
	id: string;
	title: string;
	status?: string;
	value?: string | number | null;
	createdAt?: string | Date | null;
}

interface DashboardResponse {
	stats: {
		activeProjects: number;
	};
	myProjects?: DashboardProject[];
}

const ProjectTracker = memo(function ProjectTracker() {
	const { user } = useAuth();
	const [selectedProject, setSelectedProject] = useState<DashboardProject | null>(null);
	const [filterStatus, setFilterStatus] = useState("all");
	const [search, setSearch] = useState("");
	const [location] = useLocation();

	const { data, isLoading } = useQuery<DashboardResponse>({
		queryKey: ["/api/dashboard", user?.id],
		enabled: !!user?.id,
	});

	const dealRoomRole: DealRoomRole = useMemo(() => {
		if (!user) return "guest";
		const roles: string[] = Array.isArray((user as any).roles) && (user as any).roles.length
			? ((user as any).roles as string[])
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
	}, [user]);

	const projects: (DashboardProject & { status: string })[] = (data?.myProjects ?? []).map((p) => ({
		...p,
		status: p.status || "new",
	}));

	const getStatusColor = (status: string) => getStatusColorClass(status);

	const filteredProjects = projects.filter((project) => {
		const matchesStatus = filterStatus === "all" || project.status === filterStatus;
		const matchesSearch =
			!search.trim() || project.title.toLowerCase().includes(search.trim().toLowerCase());
		return matchesStatus && matchesSearch;
	});

	const projectStats = {
		active: projects.filter((p) => p.status !== "closed" && p.status !== "lost").length,
		won: projects.filter((p) => p.status === "won").length,
		total: projects.length,
	};

	// Support deep-linking into a specific project via ?jobId= or ?projectId=
	useEffect(() => {
		if (!location || !projects.length) return;
		const queryString = location.split("?")[1] || "";
		if (!queryString) return;
		const params = new URLSearchParams(queryString);
		const jobId = params.get("jobId") || params.get("projectId");
		if (!jobId) return;
		const match = projects.find((p) => p.id === jobId);
		if (!match) return;
		setSelectedProject((current) => (current?.id === match.id ? current : match));
	}, [location, projects]);

	// If there is no deep-link but projects exist, default to the first project
	useEffect(() => {
		if (!projects.length) return;
		if (selectedProject) return;
		const queryString = location.split("?")[1] || "";
		const params = new URLSearchParams(queryString);
		const jobId = params.get("jobId") || params.get("projectId");
		if (jobId) return; // deep-link handler above will take precedence
		setSelectedProject(projects[0]);
	}, [projects, selectedProject, location]);

	return (
		<div className="space-y-6">
			<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
				<Card className="bg-slate-800/50 border-slate-700">
					<CardHeader className="pb-3">
						<CardTitle className="text-sm text-gray-400">Active Projects</CardTitle>
						<CardDescription>Projects that are still moving</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="text-3xl font-bold text-white">{projectStats.active}</div>
					</CardContent>
				</Card>

				<Card className="bg-slate-800/50 border-slate-700">
					<CardHeader className="pb-3">
						<CardTitle className="text-sm text-gray-400">Projects Won</CardTitle>
						<CardDescription>Jobs where you were chosen</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="text-3xl font-bold text-emerald-400">{projectStats.won}</div>
					</CardContent>
				</Card>

				<Card className="bg-slate-800/50 border-slate-700">
					<CardHeader className="pb-3">
						<CardTitle className="text-sm text-gray-400">Total Projects</CardTitle>
						<CardDescription>Lifetime project requests</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="text-3xl font-bold text-sky-400">{projectStats.total}</div>
					</CardContent>
				</Card>
			</div>

			<Card className="bg-slate-800/50 border-slate-700 mb-6">
				<CardHeader>
					<div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
						<div>
							<CardTitle className="text-white">All projects</CardTitle>
							<CardDescription>Track and manage project requests</CardDescription>
						</div>

						<div className="flex items-center gap-3">
							<div className="relative">
								<Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
								<Input
									placeholder="Search projects..."
									value={search}
									onChange={(e) => setSearch(e.target.value)}
									className="pl-10 bg-slate-900/50 border-slate-700 text-white"
								/>
							</div>

							<Select value={filterStatus} onValueChange={setFilterStatus}>
								<SelectTrigger className="w-40 bg-slate-900/50 border-slate-700 text-white">
									<SelectValue placeholder="Status" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All status</SelectItem>
									<SelectItem value="new">New</SelectItem>
									<SelectItem value="contacted">Contacted</SelectItem>
									<SelectItem value="quoted">Quoted</SelectItem>
									<SelectItem value="proposal">Proposal</SelectItem>
									<SelectItem value="won">Won</SelectItem>
									<SelectItem value="lost">Lost</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>
				</CardHeader>

				<CardContent>
					{isLoading ? (
						<div className="py-6 text-center text-sm text-gray-400">Loading projects...</div>
					) : projects.length === 0 ? (
						<div className="py-6 text-center text-sm text-gray-400">No projects yet</div>
					) : (
						<div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2.1fr)_minmax(0,1.4fr)] gap-6">
							<div className="space-y-3">
								{filteredProjects.map((project) => (
									<Card
										key={project.id}
										className={`bg-slate-900/50 border-slate-700 hover:border-orange-500/50 transition-colors cursor-pointer ${selectedProject?.id === project.id ? "ring-1 ring-orange-500/60" : ""}`}
										onClick={() => setSelectedProject(project)}
									>
										<CardContent className="p-4">
											<div className="flex items-center justify-between">
												<div className="flex-1">
													<div className="flex items-center gap-3 mb-2">
														<h3 className="text-lg font-semibold text-white">{project.title}</h3>
														<Badge className={`${getStatusColor(project.status)} text-white border-0`}>
															{project.status}
														</Badge>
													</div>

													<div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-gray-400">
														<div className="flex items-center gap-2">
															<Wrench className="w-4 h-4" />
															<span>{project.value ? `$${project.value}` : "No estimate yet"}</span>
														</div>
														<div className="flex items-center gap-2">
															<MapPin className="w-4 h-4" />
															<span>{getUserLocationLabel(user)}</span>
														</div>
														<div className="flex items-center gap-2">
															<Calendar className="w-4 h-4" />
															<span>
																{project.createdAt
																		? `Added ${formatDistanceToNow(new Date(project.createdAt), { addSuffix: true })}`
																		: "Created recently"}
															</span>
														</div>
													</div>
											</div>

											<div className="flex items-center gap-2 ml-4">
												<Button
													variant="outline"
													size="sm"
													className="border-slate-700 hover:bg-slate-700"
												>
													<Phone className="w-4 h-4 mr-2" />
													Call
												</Button>
												<Button
													variant="outline"
													size="sm"
													className="border-slate-700 hover:bg-slate-700"
												>
													<Mail className="w-4 h-4 mr-2" />
													Message
												</Button>
											</div>
										</div>
									</CardContent>
								</Card>
								))}

							<div className="mt-4 lg:hidden">
								{selectedProject ? (
									<DealRoomPanel jobId={selectedProject.id} userRole={dealRoomRole} />
								) : (
									<div className="text-xs text-gray-500 border border-dashed border-slate-700 rounded-md bg-slate-900/40 p-3">
										Select a project above to open its deal room.
									</div>
								)}
							</div>
							</div>

							<div className="hidden lg:block">
								{selectedProject ? (
									<DealRoomPanel jobId={selectedProject.id} userRole={dealRoomRole} />
								) : (
									<div className="h-full flex items-center justify-center text-xs text-gray-500 border border-dashed border-slate-700 rounded-md bg-slate-900/40 p-4">
										Select a project on the left to open its deal room.
									</div>
								)}
							</div>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
});

export default ProjectTracker;
