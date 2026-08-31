import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/authorize';
import { Role } from '@prisma/client';
import { Client } from 'pg';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function generateTimestamp(): string {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
}

function parseDatabaseUrl(url: string) {
    const parsed = new URL(url);
    return {
        host: parsed.hostname,
        port: parseInt(parsed.port || '5432'),
        user: parsed.username,
        password: parsed.password,
        database: parsed.pathname.replace('/', ''),
    };
}

function escapeSql(value: any, dataType: string): string {
    if (value === null || value === undefined) return 'NULL';

    if (dataType === 'boolean') return value ? 'TRUE' : 'FALSE';

    if (['integer', 'smallint', 'bigint', 'serial', 'bigserial', 'real', 'double precision', 'numeric', 'decimal'].some(t => dataType.includes(t))) {
        return String(value);
    }

    if (dataType === 'jsonb' || dataType === 'json') {
        const str = typeof value === 'string' ? value : JSON.stringify(value);
        return `'${str.replace(/'/g, "''")}'::json`;
    }

    if (dataType === 'bytea' || Buffer.isBuffer(value)) {
        const hex = Buffer.isBuffer(value) ? value.toString('hex') : Buffer.from(value).toString('hex');
        return `E'\\\\x${hex}'`;
    }

    if (dataType.includes('[]')) {
        if (Array.isArray(value)) {
            const innerType = dataType.replace('[]', '');
            return `ARRAY[${value.map(v => escapeSql(v, innerType)).join(', ')}]`;
        }
    }

    const str = String(value).replace(/'/g, "''");
    return `'${str}'`;
}

export async function GET(request: NextRequest) {
    let client: Client | null = null;

    try {
        const user = await requireRole(Role.SuperAdmin);

        const databaseUrl = process.env.DATABASE_URL;
        if (!databaseUrl) {
            return NextResponse.json(
                { success: false, message: 'DATABASE_URL not configured' },
                { status: 500 }
            );
        }

        // const db = parseDatabaseUrl(databaseUrl);
        // client = new Client({
        //     host: db.host,
        //     port: db.port,
        //     user: db.user,
        //     password: db.password,
        //     database: db.database,
        //     connectionTimeoutMillis: 10000,
        //     statement_timeout: 60000,
        // });

        client = new Client({
            connectionString: databaseUrl,
            connectionTimeoutMillis: 10000,
            statement_timeout: 60000,
        });

        await client.connect();

        const timestamp = generateTimestamp();
        const filename = `${timestamp}.sql`;
        const lines: string[] = [];

        lines.push('-- ============================================================');
        lines.push(`-- Database Backup: ${parseDatabaseUrl(databaseUrl).database}`);
        lines.push(`-- Generated: ${new Date().toISOString()}`);
        lines.push('-- ============================================================');
        lines.push('');

        // Get all user tables (exclude Prisma migrations)
        const tablesResult = await client.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
        `);

        const tables: string[] = tablesResult.rows.map(r => r.table_name);

        // Get all sequences
        const sequencesResult = await client.query(`
            SELECT sequence_name
            FROM information_schema.sequences
            WHERE sequence_schema = 'public'
            ORDER BY sequence_name
        `);

        // Disable foreign key checks during restore
        lines.push('SET statement_timeout = 0;');
        lines.push('SET lock_timeout = 0;');
        lines.push('SET client_encoding = \'UTF8\';');
        lines.push('SET standard_conforming_strings = on;');
        lines.push('SET check_function_bodies = false;');
        lines.push('SET xmloption = content;');
        lines.push('SET client_min_messages = warning;');
        lines.push('SET row_security = off;');
        lines.push('');
        lines.push('SET default_tablespace = \'\';');
        lines.push('SET default_table_access_method = heap;');
        lines.push('');

        // Generate DROP + CREATE TABLE statements
        for (const tableName of tables) {
            lines.push(`--`);
            lines.push(`-- Table: ${tableName}`);
            lines.push(`--`);
            lines.push(`DROP TABLE IF EXISTS "${tableName}" CASCADE;`);

            const columnsResult = await client.query(`
                SELECT
                    c.column_name,
                    c.data_type,
                    c.udt_name,
                    c.character_maximum_length,
                    c.numeric_precision,
                    c.is_nullable,
                    c.column_default,
                    c.ordinal_position
                FROM information_schema.columns c
                WHERE c.table_schema = 'public'
                AND c.table_name = $1
                ORDER BY c.ordinal_position
            `, [tableName]);

            const columns = columnsResult.rows;

            const createLines: string[] = [];
            createLines.push(`CREATE TABLE "${tableName}" (`);

            const columnDefs: string[] = [];
            for (const col of columns) {
                let colType = col.udt_name || col.data_type;
                if (col.character_maximum_length && !colType.includes('(')) {
                    colType += `(${col.character_maximum_length})`;
                }
                if (col.data_type === 'USER-DEFINED') {
                    colType = col.udt_name;
                }

                let def = `    "${col.column_name}" ${colType}`;
                if (col.is_nullable === 'NO') def += ' NOT NULL';
                if (col.column_default) {
                    def += ` DEFAULT ${col.column_default}`;
                }
                columnDefs.push(def);
            }

            // Get primary key
            const pkResult = await client.query(`
                SELECT kcu.column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                    ON tc.constraint_name = kcu.constraint_name
                    AND tc.table_schema = kcu.table_schema
                WHERE tc.constraint_type = 'PRIMARY KEY'
                AND tc.table_schema = 'public'
                AND tc.table_name = $1
                ORDER BY kcu.ordinal_position
            `, [tableName]);

            if (pkResult.rows.length > 0) {
                const pkCols = pkResult.rows.map(r => `"${r.column_name}"`).join(', ');
                columnDefs.push(`    PRIMARY KEY (${pkCols})`);
            }

            createLines.push(columnDefs.join(',\n'));
            createLines.push(');');
            lines.push(...createLines);
            lines.push('');
        }

        // Get and generate sequences
        for (const seq of sequencesResult.rows) {
            const seqName = seq.sequence_name;
            lines.push(`CREATE SEQUENCE IF NOT EXISTS "${seqName}";`);
            lines.push('');
        }

        // Get and generate foreign key constraints
        const fkResult = await client.query(`
            SELECT
                tc.constraint_name,
                tc.table_name,
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name,
                rc.update_rule,
                rc.delete_rule
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage ccu
                ON ccu.constraint_name = tc.constraint_name
                AND ccu.table_schema = tc.table_schema
            JOIN information_schema.referential_constraints rc
                ON rc.constraint_name = tc.constraint_name
                AND rc.constraint_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema = 'public'
            ORDER BY tc.table_name, tc.constraint_name
        `);

        for (const fk of fkResult.rows) {
            lines.push(`ALTER TABLE ONLY "${fk.table_name}" ADD CONSTRAINT "${fk.constraint_name}"`);
            lines.push(`    FOREIGN KEY ("${fk.column_name}") REFERENCES "${fk.foreign_table_name}"("${fk.foreign_column_name}")`);
            lines.push(`    ON UPDATE ${fk.update_rule} ON DELETE ${fk.delete_rule};`);
            lines.push('');
        }

        // Get and generate indexes
        const indexesResult = await client.query(`
            SELECT
                indexname,
                indexdef
            FROM pg_indexes
            WHERE schemaname = 'public'
            AND tablename NOT LIKE '_prisma_%'
            AND indexname NOT LIKE '%_pkey'
            ORDER BY indexname
        `);

        for (const idx of indexesResult.rows) {
            lines.push(`${idx.indexdef};`);
        }
        lines.push('');

        // Get and generate unique constraints
        const uniqueResult = await client.query(`
            SELECT
                tc.constraint_name,
                tc.table_name,
                string_agg('"' || kcu.column_name || '"', ', ' ORDER BY kcu.ordinal_position) as columns
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            WHERE tc.constraint_type = 'UNIQUE'
            AND tc.table_schema = 'public'
            GROUP BY tc.constraint_name, tc.table_name
        `);

        for (const uq of uniqueResult.rows) {
            lines.push(`ALTER TABLE ONLY "${uq.table_name}" ADD CONSTRAINT "${uq.constraint_name}" UNIQUE (${uq.columns});`);
        }
        lines.push('');

        // Insert data
        for (const tableName of tables) {
            const countResult = await client.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
            const count = parseInt(countResult.rows[0].count);

            if (count === 0) continue;

            const columnsResult = await client.query(`
                SELECT column_name, data_type, udt_name
                FROM information_schema.columns
                WHERE table_schema = 'public'
                AND table_name = $1
                ORDER BY ordinal_position
            `, [tableName]);

            const columns = columnsResult.rows;
            const colNames = columns.map(c => `"${c.column_name}"`).join(', ');
            const colTypes = columns.map(c => c.udt_name || c.data_type);

            lines.push(`--`);
            lines.push(`-- Data: ${tableName} (${count} rows)`);
            lines.push(`--`);

            const dataResult = await client.query(`SELECT * FROM "${tableName}"`);

            const batchSize = 100;
            for (let i = 0; i < dataResult.rows.length; i += batchSize) {
                const batch = dataResult.rows.slice(i, i + batchSize);
                for (const row of batch) {
                    const values = columns.map((col, idx) => escapeSql(row[col.column_name], colTypes[idx]));
                    lines.push(`INSERT INTO "${tableName}" (${colNames}) VALUES (${values.join(', ')});`);
                }
            }
            lines.push('');
        }

        lines.push('');

        lines.push('-- ============================================================');
        lines.push('-- End of backup');
        lines.push('-- ============================================================');

        await client.end();

        const sqlDump = lines.join('\n');

        if (!sqlDump || sqlDump.trim().length === 0) {
            return NextResponse.json(
                { success: false, message: 'Generated empty backup. Database may be empty.' },
                { status: 500 }
            );
        }

        return new NextResponse(sqlDump, {
            headers: {
                'Content-Type': 'application/sql',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Cache-Control': 'no-cache, no-store, must-revalidate',
            },
        });
    } catch (error: any) {
        console.error('[DB BACKUP] Error:', error?.message || error);

        if (client) {
            try { await client.end(); } catch {}
        }

        if (error?.message?.includes('Forbidden') || error?.message?.includes('Unauthorized')) {
            return NextResponse.json(
                { success: false, message: 'Access denied. SuperAdmin role required.' },
                { status: 403 }
            );
        }

        return NextResponse.json(
            { success: false, message: error?.message || 'Failed to generate database backup' },
            { status: 500 }
        );
    }
}
