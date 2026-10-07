DO $$
DECLARE
    target_table text;
BEGIN
    IF to_regclass('public.testexample') IS NOT NULL THEN
        target_table := 'testexample';
    ELSIF to_regclass('public.test_example') IS NOT NULL THEN
        target_table := 'test_example';
    ELSE
        RAISE EXCEPTION 'Could not find TestExample table (expected testexample or test_example)';
    END IF;

    EXECUTE format(
        'ALTER TABLE %I ADD COLUMN IF NOT EXISTS sort_order integer',
        target_table
    );

    EXECUTE format(
        'WITH ranked AS (
            SELECT id,
                   row_number() OVER (PARTITION BY test_id ORDER BY ctid) - 1 AS rn
            FROM %I
         )
         UPDATE %I te
         SET sort_order = ranked.rn
         FROM ranked
         WHERE te.id = ranked.id
           AND te.sort_order IS NULL',
        target_table,
        target_table
    );

    EXECUTE format(
        'UPDATE %I SET sort_order = 0 WHERE sort_order IS NULL',
        target_table
    );
END $$;
