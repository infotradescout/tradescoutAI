export interface ConnectionUser {
	userId: string;
	displayName: string;
	location?: string | null;
	avatarUrl?: string | null;
	joinedAt?: string | null;
	followedAt?: string | null;
}

export interface ConnectionsSummary {
	followers: number;
	following: number;
	mutual: number;
}

export interface ViewerConnectionState {
	isFollowing: boolean;
	isFollowedBy: boolean;
	isMutual: boolean;
}

export async function fetchConnectionsSummary(): Promise<ConnectionsSummary> {
	const res = await fetch("/api/social/connections/summary", {
		credentials: "include",
		headers: { Accept: "application/json" },
	});

	if (!res.ok) {
		const body = await res.json().catch(() => null);
		const message = body?.message || `Failed to load connections summary (${res.status})`;
		throw new Error(message);
	}

	const json = await res.json();
	return {
		followers: Number(json.followers ?? 0),
		following: Number(json.following ?? 0),
		mutual: Number(json.mutual ?? 0),
	};
}

export async function fetchFollowing(): Promise<ConnectionUser[]> {
	const res = await fetch("/api/social/connections/following", {
		credentials: "include",
		headers: { Accept: "application/json" },
	});

	if (!res.ok) {
		const body = await res.json().catch(() => null);
		const message = body?.message || `Failed to load following list (${res.status})`;
		throw new Error(message);
	}

	const json = await res.json();
	if (!Array.isArray(json)) return [];

	return json.map((item: any): ConnectionUser => ({
		userId: String(item.userId ?? item.id ?? ""),
		displayName: String(item.displayName ?? item.name ?? "Unknown user"),
		location: item.location ?? null,
		avatarUrl: item.avatarUrl ?? null,
		joinedAt: item.joinedAt ?? null,
		followedAt: item.followedAt ?? null,
	}));
}

export async function fetchFollowers(): Promise<ConnectionUser[]> {
	const res = await fetch("/api/social/connections/followers", {
		credentials: "include",
		headers: { Accept: "application/json" },
	});

	if (!res.ok) {
		const body = await res.json().catch(() => null);
		const message = body?.message || `Failed to load followers list (${res.status})`;
		throw new Error(message);
	}

	const json = await res.json();
	if (!Array.isArray(json)) return [];

	return json.map((item: any): ConnectionUser => ({
		userId: String(item.userId ?? item.id ?? ""),
		displayName: String(item.displayName ?? item.name ?? "Unknown user"),
		location: item.location ?? null,
		avatarUrl: item.avatarUrl ?? null,
		joinedAt: item.joinedAt ?? null,
		followedAt: item.followedAt ?? null,
	}));
}

export async function followUser(targetUserId: string): Promise<ViewerConnectionState> {
	if (!targetUserId) {
		throw new Error("targetUserId is required to follow a user");
	}

	const res = await fetch(`/api/social/connections/${encodeURIComponent(targetUserId)}/follow`, {
		method: "POST",
		credentials: "include",
		headers: { "Content-Type": "application/json", Accept: "application/json" },
	});

	if (!res.ok) {
		const body = await res.json().catch(() => null);
		const message = body?.message || body?.error || `Failed to follow user (${res.status})`;
		throw new Error(message);
	}

	const json = await res.json();
	const viewer = json.viewerConnection ?? {};
	return {
		isFollowing: Boolean(viewer.isFollowing ?? true),
		isFollowedBy: Boolean(viewer.isFollowedBy ?? false),
		isMutual: Boolean(viewer.isMutual ?? false),
	};
}

export async function unfollowUser(targetUserId: string): Promise<ViewerConnectionState> {
	if (!targetUserId) {
		throw new Error("targetUserId is required to unfollow a user");
	}

	const res = await fetch(`/api/social/connections/${encodeURIComponent(targetUserId)}/follow`, {
		method: "DELETE",
		credentials: "include",
		headers: { Accept: "application/json" },
	});

	if (!res.ok) {
		const body = await res.json().catch(() => null);
		const message = body?.message || body?.error || `Failed to unfollow user (${res.status})`;
		throw new Error(message);
	}

	const json = await res.json();
	const viewer = json.viewerConnection ?? {};
	return {
		isFollowing: Boolean(viewer.isFollowing ?? false),
		isFollowedBy: Boolean(viewer.isFollowedBy ?? false),
		isMutual: Boolean(viewer.isMutual ?? false),
	};
}
