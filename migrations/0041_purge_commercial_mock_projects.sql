-- Purge mock/demo/sample/test/placeholder data from commercial directory
-- This delete is intentional and permanent for non-production-like records.

DELETE FROM "commercial_projects"
WHERE
  "title" ~* '(mock|demo|sample|test|placeholder)'
  OR "summary" ~* '(mock|demo|sample|test|placeholder)'
  OR "slug" ~* '(mock|demo|sample|test|placeholder)';
