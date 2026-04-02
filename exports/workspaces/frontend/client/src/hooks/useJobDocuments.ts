import { useQuery } from "@tanstack/react-query";

export type JobDocumentType =
	| "MATERIAL_LIST"
	| "ESTIMATE"
	| "CONTRACT"
	| "INVOICE"
	| "RECEIPT";

export interface JobDocument {
	id: string;
	job_id: string | null;
	type: JobDocumentType;
	status: string;
	version: number;
	payload: any;
	permissions: any;
	created_by: string;
	created_at: string;
	updated_at: string;
	share_token: string | null;
	signed_at: string | null;
}

interface JobDocumentsResponse {
	documents: JobDocument[];
}

export function useJobDocuments(jobId: string | null | undefined) {
	const enabled = !!jobId;

	const query = useQuery<JobDocumentsResponse>({
		queryKey: ["/api/jobs", jobId, "documents"],
		enabled,
		queryFn: async () => {
			if (!jobId) {
				return { documents: [] };
			}
			const res = await fetch(`/api/jobs/${jobId}/documents`, {
				credentials: "include",
				headers: { Accept: "application/json" },
			});
			if (!res.ok) {
				throw new Error(`Failed to load documents (${res.status})`);
			}
			return (await res.json()) as JobDocumentsResponse;
		},
	});

	return {
		...query,
		documents: query.data?.documents ?? [],
	};
}
