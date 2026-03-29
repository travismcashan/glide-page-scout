
-- Update existing estimate_tasks that still have size/size_multiplied formula_configs
-- Match them to their master_task and copy the new formula_config
UPDATE estimate_tasks et
SET formula_config = mt.formula_config
FROM master_tasks mt
WHERE et.master_task_id = mt.id
  AND et.formula_config::text LIKE '%"size"%';
