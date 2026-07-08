export type ThreadableCommunityComment = {
  id: string;
  parentCommentId?: string | null;
  replies?: ThreadableCommunityComment[];
};

export function buildOneLevelCommentThreads<T extends ThreadableCommunityComment>(
  comments: T[]
): T[] {
  const byId = new Map<string, T & { replies: T[] }>();
  const roots: Array<T & { replies: T[] }> = [];

  for (const comment of comments) {
    byId.set(comment.id, { ...comment, replies: [] });
  }

  for (const comment of byId.values()) {
    const parentId = comment.parentCommentId ? String(comment.parentCommentId) : "";
    const parent = parentId ? byId.get(parentId) : null;
    if (parent && !parent.parentCommentId) {
      parent.replies = [...(parent.replies || []), comment];
    } else if (!comment.parentCommentId) {
      roots.push(comment);
    }
  }

  return roots;
}
