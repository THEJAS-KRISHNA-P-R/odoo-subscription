package main

import (
	"context"
	"log"
	"os"
	"time"

	"brightloop/internal/db"
	"brightloop/migrations"
)

func main() {
	dsn := os.Getenv("DATABASE_URL")
	database, err := db.Open(dsn)
	if err != nil {
		log.Fatalf("failed to open database: %v", err)
	}
	defer database.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := migrations.Run(ctx, database); err != nil {
		log.Fatalf("migration failed: %v", err)
	}

	log.Println("Migration completed.")
}

