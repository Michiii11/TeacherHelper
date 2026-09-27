-- Collection names are unique per owner, not globally.
-- Two different users may own collections with the same name.
-- Within one owner, names remain case-insensitively unique.

-- Remove an old Hibernate-generated UNIQUE constraint on collection.name,
-- regardless of its generated constraint name.
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    FOR constraint_name IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class tbl
          ON tbl.oid = con.conrelid
        JOIN pg_namespace ns
          ON ns.oid = tbl.relnamespace
        JOIN pg_attribute attr
          ON attr.attrelid = tbl.oid
         AND attr.attnum = ANY(con.conkey)
        WHERE ns.nspname = current_schema()
          AND tbl.relname = 'collection'
          AND con.contype = 'u'
          AND cardinality(con.conkey) = 1
          AND attr.attname = 'name'
    LOOP
        EXECUTE format(
            'ALTER TABLE %I DROP CONSTRAINT %I',
            'collection',
            constraint_name
        );
    END LOOP;
END $$;

-- Safety net for a directly-created unique index on name that is not backed
-- by a constraint.
DO $$
DECLARE
    index_name TEXT;
BEGIN
    FOR index_name IN
        SELECT idx.relname
        FROM pg_index ix
        JOIN pg_class tbl
          ON tbl.oid = ix.indrelid
        JOIN pg_namespace ns
          ON ns.oid = tbl.relnamespace
        JOIN pg_class idx
          ON idx.oid = ix.indexrelid
        JOIN pg_attribute attr
          ON attr.attrelid = tbl.oid
         AND attr.attnum = ANY(ix.indkey)
        LEFT JOIN pg_constraint con
          ON con.conindid = ix.indexrelid
        WHERE ns.nspname = current_schema()
          AND tbl.relname = 'collection'
          AND ix.indisunique
          AND ix.indnatts = 1
          AND attr.attname = 'name'
          AND con.oid IS NULL
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', index_name);
    END LOOP;
END $$;

-- Match the application's case-insensitive duplicate check.
CREATE UNIQUE INDEX IF NOT EXISTS uq_collection_admin_lower_name
    ON collection (admin_id, LOWER(name));
