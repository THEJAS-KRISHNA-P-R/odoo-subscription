package migrations

import (
	"context"
	"database/sql"
	_ "embed"
	"fmt"
	"log"
)

//go:embed 001_init.sql
var initSQL string

// Run applies the initial schema migration to the database.
func Run(ctx context.Context, db *sql.DB) error {
	log.Println("Applying schema migration: 001_init.sql...")
	_, err := db.ExecContext(ctx, initSQL)
	if err != nil {
		return fmt.Errorf("migration 001_init.sql failed: %w", err)
	}
	log.Println("Schema migration 001_init.sql applied successfully.")
	return nil
}
