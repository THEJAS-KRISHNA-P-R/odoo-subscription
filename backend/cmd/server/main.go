package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"

	_ "github.com/jackc/pgx/v5/stdlib"
)

func main() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "postgres://postgres:postgres@localhost:5432/brightloop?sslmode=disable"
	}

	db, err := sql.Open("pgx", dsn)
	if err != nil {
		log.Fatal("failed to open db:", err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Fatal("failed to ping db:", err)
	}
	fmt.Println("connected to db")

	// Run migrations from migrations/001_init.sql
	// (in a full app, use migrate tool; here we run the SQL directly)
	migrationSQL := `
	CREATE EXTENSION IF NOT EXISTS citext;
	CREATE TYPE role_t        AS ENUM ('admin','staff','customer');
	CREATE TYPE period_t      AS ENUM ('daily','weekly','monthly','yearly');
	CREATE TYPE sub_status_t  AS ENUM ('draft','quotation','confirmed','active','paused','closed');
	CREATE TYPE inv_status_t  AS ENUM ('draft','confirmed','paid','cancelled');
	CREATE TYPE disc_kind_t   AS ENUM ('fixed','percent');
	CREATE TYPE disc_scope_t  AS ENUM ('product','subscription');
	CREATE TYPE pay_method_t  AS ENUM ('cash','bank_transfer','card','upi','cheque');

	CREATE TABLE users (
	  id BIGSERIAL PRIMARY KEY,
	  email CITEXT NOT NULL UNIQUE,
	  password_hash TEXT NOT NULL,
	  full_name TEXT NOT NULL CHECK (length(trim(full_name)) > 0),
	  role role_t NOT NULL,
	  is_active BOOLEAN NOT NULL DEFAULT true,
	  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
	);
	`
	if _, err := db.Exec(migrationSQL); err != nil {
		log.Printf("migration note (may already exist): %v", err)
	}

	// Simple health check endpoint route setup would go here
	log.Println("server starting...")
	// In a real app, start http.Handler here
}