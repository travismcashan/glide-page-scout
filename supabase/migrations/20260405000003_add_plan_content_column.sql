-- Add plan_content JSONB column to wishlist_items for storing structured plan data
ALTER TABLE wishlist_items
  ADD COLUMN plan_content JSONB DEFAULT NULL;

COMMENT ON COLUMN wishlist_items.plan_content IS
  'Structured plan data: { research: string, steps: { text: string, done: boolean }[], affected_files: string[], dependencies: string[] }';
