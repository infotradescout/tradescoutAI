-- postComments.postId was declared against socialPosts.id, but every live
-- caller (server/routes.ts community comment routes) creates/queries
-- comment rows keyed by communityPosts.id values. This fixes the foreign
-- key to match actual usage. Safe: post_comments has zero rows in
-- production as of 2026-07-21 (confirmed via direct read before writing
-- this migration), so there is no orphan-row risk.

ALTER TABLE post_comments
  DROP CONSTRAINT IF EXISTS post_comments_post_id_social_posts_id_fk;

ALTER TABLE post_comments
  ADD CONSTRAINT post_comments_post_id_community_posts_id_fk
  FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE;
