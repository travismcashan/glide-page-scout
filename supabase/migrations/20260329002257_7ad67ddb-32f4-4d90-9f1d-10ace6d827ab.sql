-- Mark optional research tasks as NOT required in master_tasks
UPDATE master_tasks SET is_required = false WHERE name IN (
  'Interviews', 'Moderated User Testing', 'Focus Groups',
  'Empathy Map', 'Scenario Map',
  'Design Validation > Moderated User Testing', 'Design Validation > Focus Groups'
);

-- Also update existing estimate_tasks to match
UPDATE estimate_tasks SET is_required = false WHERE task_name IN (
  'Interviews', 'Moderated User Testing', 'Focus Groups',
  'Empathy Map', 'Scenario Map',
  'Design Validation > Moderated User Testing', 'Design Validation > Focus Groups'
);