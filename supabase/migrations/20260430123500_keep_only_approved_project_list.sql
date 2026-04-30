-- Keep only the approved project list shared by the workspace owner.
-- This migration removes projects outside the approved 24-project list
-- for the workspace owned by haitham.pm@gmail.com.
--
-- It also updates/normalizes project dates and status for the approved list.

WITH approved_projects(project_name, start_date_value, end_date_value) AS (
  VALUES
    ('EPM-940 Phase 5', DATE '2025-12-10', DATE '2028-12-09'),
    ('EPM-Cleaning P4', DATE '2025-11-03', DATE '2028-11-02'),
    ('EPM-IDT Phase 3', DATE '2023-12-31', DATE '2026-12-30'),
    ('EPM-Smart City', DATE '2024-07-01', DATE '2027-06-30'),
    ('EPM-Smart Lighting', DATE '2024-09-01', DATE '2026-08-31'),
    ('EPM-Visual Distortion Services', DATE '2024-07-01', DATE '2027-06-30'),
    ('EPM-Webportal 2022-2025', DATE '2022-08-14', DATE '2025-11-30'),
    ('EPM-Zain Phase 3', DATE '2024-11-01', DATE '2027-10-31'),
    ('HBM-Cleaning', DATE '2024-11-26', DATE '2025-12-31'),
    ('HBM-SMO', DATE '2025-02-17', DATE '2026-02-16'),
    ('Hail-940', DATE '2025-03-09', DATE '2026-03-08'),
    ('Hail-Archiving P2', DATE '2024-10-09', DATE '2026-10-08'),
    ('Hail-Cleaning', DATE '2023-02-14', DATE '2026-06-01'),
    ('Hail-Cyber Security', DATE '2023-10-22', DATE '2026-01-02'),
    ('Hail-Etmam', DATE '2025-04-09', DATE '2026-04-08'),
    ('Hail-Gardening Old', DATE '2023-02-16', DATE '2026-06-04'),
    ('Hail-Infra 80%', DATE '2025-02-27', DATE '2027-08-26'),
    ('Hail-Investment-ICOG', DATE '2024-12-12', DATE '2026-12-11'),
    ('Hail-Revenue Collection', DATE '2023-08-06', DATE '2026-08-05'),
    ('Hail-Zain (Axionic - ERP)', DATE '2023-03-30', DATE '2026-03-29'),
    ('JRM development & Operation', DATE '2024-01-10', DATE '2027-01-09'),
    ('MRM-Operate & Maintenance 940', DATE '2023-11-15', DATE '2026-11-14'),
    ('EPM-940 Phase 4', DATE '2022-08-24', DATE '2025-12-07'),
    ('EPM-Digital Transformation', DATE '2022-09-04', DATE '2025-12-21')
),
target_workspace AS (
  SELECT wm.workspace_id
  FROM public.workspace_memberships wm
  JOIN auth.users u ON u.id = wm.user_id
  WHERE lower(u.email) = lower('haitham.pm@gmail.com')
    AND wm.status = 'active'
  LIMIT 1
),
insert_missing AS (
  INSERT INTO public.projects (
    workspace_id,
    name,
    description,
    status,
    priority,
    progress,
    start_date,
    end_date,
    created_at,
    updated_at
  )
  SELECT
    tw.workspace_id,
    ap.project_name,
    'Approved project from implementation activities matrix.',
    'active',
    'medium',
    0,
    ap.start_date_value,
    ap.end_date_value,
    NOW(),
    NOW()
  FROM approved_projects ap
  CROSS JOIN target_workspace tw
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.workspace_id = tw.workspace_id
      AND lower(trim(p.name)) = lower(trim(ap.project_name))
  )
  RETURNING id
),
update_existing AS (
  UPDATE public.projects p
  SET
    start_date = ap.start_date_value,
    end_date = ap.end_date_value,
    status = CASE WHEN p.status = 'archived' THEN 'active' ELSE p.status END,
    updated_at = NOW()
  FROM approved_projects ap
  CROSS JOIN target_workspace tw
  WHERE p.workspace_id = tw.workspace_id
    AND lower(trim(p.name)) = lower(trim(ap.project_name))
  RETURNING p.id
)
DELETE FROM public.projects p
USING target_workspace tw
WHERE p.workspace_id = tw.workspace_id
  AND NOT EXISTS (
    SELECT 1
    FROM approved_projects ap
    WHERE lower(trim(ap.project_name)) = lower(trim(p.name))
  );

-- Verification:
-- SELECT count(*) AS total_projects FROM public.projects p
-- JOIN public.workspace_memberships wm ON wm.workspace_id = p.workspace_id
-- JOIN auth.users u ON u.id = wm.user_id
-- WHERE lower(u.email) = lower('haitham.pm@gmail.com') AND wm.status = 'active';
--
-- SELECT name, start_date, end_date, status FROM public.projects ORDER BY name;
