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
        'ALTER TABLE %I ADD COLUMN IF NOT EXISTS example_order integer',
        target_table
    );

    -- Give existing test entries a deterministic initial order.
    -- Newly saved tests will afterwards persist the exact UI order via @OrderColumn.
    EXECUTE format(
        'WITH ranked AS (
            SELECT id,
                   row_number() OVER (PARTITION BY test_id ORDER BY ctid) - 1 AS rn
            FROM %I
         )
         UPDATE %I te
         SET example_order = ranked.rn
         FROM ranked
         WHERE te.id = ranked.id
           AND te.example_order IS NULL',
        target_table,
        target_table
    );
END $$;
