package main

import (
	"context"
	"database/sql"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"brightloop/internal/auth"
	"brightloop/internal/catalog"
	"brightloop/internal/db"
	"brightloop/internal/httpx"
	"brightloop/internal/plans"
)

func main() {
	database, err := db.Open(os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Fatalf("open database: %v", err)
	}
	defer database.Close()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	server := &http.Server{
		Addr:              ":" + port,
		Handler:           newRouter(database),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-stop
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := server.Shutdown(ctx); err != nil {
			log.Printf("server shutdown: %v", err)
		}
	}()

	log.Printf("Brightloop API listening on http://localhost:%s", port)
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatalf("serve: %v", err)
	}
}

func newRouter(database *sql.DB) http.Handler {
	authHandler := auth.NewHandler(auth.NewStore(database))
	catalogHandler := catalog.NewHandler(catalog.NewStore(database))
	plansHandler := plans.NewHandler(plans.NewStore(database))

	api := http.NewServeMux()
	api.HandleFunc("/api/v1/auth/signup", authHandler.Signup)
	api.HandleFunc("/api/v1/auth/login", authHandler.Login)
	api.HandleFunc("/api/v1/auth/logout", authHandler.Logout)
	api.Handle("/api/v1/auth/me", http.HandlerFunc(httpx.RequireAuth(authHandler.Me)))
	api.HandleFunc("/api/v1/auth/forgot", authHandler.Forgot)
	api.HandleFunc("/api/v1/auth/reset", authHandler.Reset)
	api.HandleFunc("/api/v1/meta", authHandler.Meta)

	api.Handle("/api/v1/staff", http.HandlerFunc(httpx.RequireRole([]string{"admin"}, authHandler.Staff)))
	api.Handle("/api/v1/staff/", http.HandlerFunc(httpx.RequireRole([]string{"admin"}, authHandler.StaffByID)))

	api.Handle("/api/v1/products", http.HandlerFunc(httpx.RequireRole([]string{"admin", "staff"}, catalogHandler.Products)))
	api.Handle("/api/v1/products/", http.HandlerFunc(httpx.RequireRole([]string{"admin", "staff"}, catalogHandler.ProductByID)))
	api.Handle("/api/v1/taxes", http.HandlerFunc(httpx.RequireRole([]string{"admin", "staff"}, catalogHandler.Taxes)))
	api.Handle("/api/v1/payment-terms", http.HandlerFunc(httpx.RequireRole([]string{"admin", "staff"}, catalogHandler.PaymentTerms)))

	api.Handle("/api/v1/plans", http.HandlerFunc(httpx.RequireRole([]string{"admin", "staff"}, plansHandler.Plans)))
	api.Handle("/api/v1/plans/", http.HandlerFunc(httpx.RequireRole([]string{"admin", "staff"}, plansHandler.PlanByID)))

	root := http.NewServeMux()
	root.HandleFunc("/healthz", health(database))
	root.Handle("/api/v1/", httpx.AuthMiddleware(httpx.RequestTimeout(api)))
	return httpx.CORS(root)
}

func health(database *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.Header().Set("Allow", http.MethodGet)
			httpx.BadRequest(w, "Method not allowed")
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		if err := database.PingContext(ctx); err != nil {
			httpx.JSONError(w, http.StatusServiceUnavailable, "unavailable", "Database is unavailable", nil)
			return
		}
		_ = httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
	}
}
