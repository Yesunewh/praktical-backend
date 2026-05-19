DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = '"Roles"'::regclass 
        AND contype = 'u'
    ) LOOP
        EXECUTE 'ALTER TABLE "Roles" DROP CONSTRAINT ' || quote_ident(r.conname) || ' CASCADE';
    END LOOP;
END $$;
