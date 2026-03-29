
-- Convert all size and size_multiplied tasks to scope-based formulas
-- Each task gets: calc_type=scope, variable=most relevant driver, multiplier=per-unit rate, min=floor

-- Strategy/Research tasks → scale with pages_for_integration
UPDATE master_tasks SET formula_config = '{"calc_type":"scope","variable":"pages","multiplier":0.125,"min":2.5}' WHERE name = 'Timeline (setup + adjustments)';
UPDATE master_tasks SET formula_config = '{"calc_type":"scope","variable":"pages","multiplier":0.1,"min":2}' WHERE name = 'KOC Prep + Recap';
UPDATE master_tasks SET formula_config = '{"calc_type":"scope","variable":"pages","multiplier":0.05,"min":0.5}' WHERE name = 'Current Site Review';
UPDATE master_tasks SET formula_config = '{"calc_type":"scope","variable":"pages","multiplier":0.075,"min":1}' WHERE name = 'Content Inventory';
UPDATE master_tasks SET formula_config = '{"calc_type":"scope","variable":"pages","multiplier":0.1,"min":1}' WHERE name = 'Content Audit';
UPDATE master_tasks SET formula_config = '{"calc_type":"scope","variable":"pages","multiplier":0.1,"min":2}' WHERE name = 'Competitor Review';
UPDATE master_tasks SET formula_config = '{"calc_type":"scope","variable":"pages","multiplier":0.075,"min":1}' WHERE name = 'SEO Insights';
UPDATE master_tasks SET formula_config = '{"calc_type":"scope","variable":"pages","multiplier":0.075,"min":1}' WHERE name = 'Hotjar Review';
UPDATE master_tasks SET formula_config = '{"calc_type":"scope","variable":"pages","multiplier":0.125,"min":2}' WHERE name = 'Keyword Research';
UPDATE master_tasks SET formula_config = '{"calc_type":"scope","variable":"pages","multiplier":0.2,"min":2}' WHERE name = 'Content Collection';

-- Design/UX tasks → scale with design_layouts
UPDATE master_tasks SET formula_config = '{"calc_type":"scope","variable":"layouts","multiplier":1.2,"min":4}' WHERE name = 'Information Architecture';
UPDATE master_tasks SET formula_config = '{"calc_type":"scope","variable":"layouts","multiplier":1,"min":4}' WHERE name = 'Client Design Review (weekly)';
UPDATE master_tasks SET formula_config = '{"calc_type":"scope","variable":"layouts","multiplier":0.2,"min":0.5}' WHERE name = 'Toolkit Outline';
UPDATE master_tasks SET formula_config = '{"calc_type":"scope","variable":"layouts","multiplier":0.4,"min":1}' WHERE name = 'Block Map + Functional Notes';
UPDATE master_tasks SET formula_config = '{"calc_type":"scope","variable":"layouts","multiplier":0.2,"min":0.5}' WHERE name = 'Functional Notes';
UPDATE master_tasks SET formula_config = '{"calc_type":"scope","variable":"layouts","multiplier":0.2,"min":0.5}' WHERE name = 'UX Notes';

-- Technical/SEO tasks → scale with pages_for_integration
UPDATE master_tasks SET formula_config = '{"calc_type":"scope","variable":"pages","multiplier":0.4,"min":6}' WHERE name = 'Performance Optimization';
UPDATE master_tasks SET formula_config = '{"calc_type":"scope","variable":"pages","multiplier":0.3,"min":4}' WHERE name = 'Technical On-Page SEO';
UPDATE master_tasks SET formula_config = '{"calc_type":"scope","variable":"pages","multiplier":0.3,"min":4}' WHERE name = 'Alt Image/Title Integration';
UPDATE master_tasks SET formula_config = '{"calc_type":"scope","variable":"pages","multiplier":0.075,"min":1}' WHERE name = 'Resolve Self Inflicted 301s';

-- DoneDone → scale with pages_for_integration (was size_multiplied with ×8)
UPDATE master_tasks SET formula_config = '{"calc_type":"scope","variable":"pages","multiplier":0.15,"min":1}' WHERE name = 'DoneDone Management';
