package migrations

import (
	"context"
	"database/sql"
	"embed"
	"fmt"
	"log"
	"sort"
	"strconv"
	"strings"
)

//go:embed *.sql
var migrationFiles embed.FS

// Run applies every embedded numbered migration exactly once.
func Run(ctx context.Context, db *sql.DB) error {
	entries, err := migrationFiles.ReadDir(".")
	if err != nil {
		return fmt.Errorf("read migrations: %w", err)
	}
	type migration struct {
		version int
		name    string
	}
	migrations := make([]migration, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".sql") {
			continue
		}
		parts := strings.SplitN(entry.Name(), "_", 2)
		if len(parts) != 2 {
			return fmt.Errorf("migration %q must start with a numeric version", entry.Name())
		}
		version, parseErr := strconv.Atoi(parts[0])
		if parseErr != nil || version < 1 {
			return fmt.Errorf("migration %q has invalid version", entry.Name())
		}
		migrations = append(migrations, migration{version: version, name: entry.Name()})
	}
	sort.Slice(migrations, func(i, j int) bool { return migrations[i].version < migrations[j].version })

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin migration: %w", err)
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, `SELECT pg_advisory_xact_lock(472819304)`); err != nil {
		return fmt.Errorf("lock migrations: %w", err)
	}
	if _, err := tx.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version INTEGER PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
		)`); err != nil {
		return fmt.Errorf("create migration table: %w", err)
	}

	for _, migration := range migrations {
		var applied bool
		if err := tx.QueryRowContext(ctx,
			`SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE version = $1)`, migration.version,
		).Scan(&applied); err != nil {
			return fmt.Errorf("check migration %03d: %w", migration.version, err)
		}
		if applied {
			continue
		}

		sqlText, err := migrationFiles.ReadFile(migration.name)
		if err != nil {
			return fmt.Errorf("read migration %s: %w", migration.name, err)
		}
		log.Printf("Applying schema migration: %s...", migration.name)
		if _, err := tx.ExecContext(ctx, string(sqlText)); err != nil {
			return fmt.Errorf("migration %s failed: %w", migration.name, err)
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO schema_migrations (version) VALUES ($1)`, migration.version); err != nil {
			return fmt.Errorf("record migration %s: %w", migration.name, err)
		}
		log.Printf("Schema migration %s applied successfully.", migration.name)
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit migrations: %w", err)
	}
	return nil
}
