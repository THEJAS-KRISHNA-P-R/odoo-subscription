package mail

import (
	"context"
	"database/sql"
	"fmt"
	"io"
	"log"
	"net"
	"net/smtp"
	"os"
	"strings"
	"time"
)

const (
	maxAttempts = 5
	batchSize   = 5
)

type Config struct {
	Addr         string
	From         string
	Username     string
	Password     string
	PollInterval time.Duration
}

type Worker struct {
	db     *sql.DB
	config Config
}

type message struct {
	id       int64
	kind     string
	to       string
	subject  string
	body     string
	refID    sql.NullInt64
	attempts int
}

func NewWorker(db *sql.DB, config Config) *Worker {
	if config.PollInterval <= 0 {
		config.PollInterval = 5 * time.Second
	}
	return &Worker{db: db, config: config}
}

func ConfigFromEnv() Config {
	addr := os.Getenv("SMTP_ADDR")
	if addr == "" {
		host := os.Getenv("SMTP_HOST")
		if host == "" {
			host = "localhost"
		}
		port := os.Getenv("SMTP_PORT")
		if port == "" {
			port = "1025"
		}
		addr = net.JoinHostPort(host, port)
	}
	return Config{
		Addr:     addr,
		From:     envOrDefault("SMTP_FROM", "no-reply@brightloop.io"),
		Username: os.Getenv("SMTP_USER"),
		Password: os.Getenv("SMTP_PASSWORD"),
	}
}

func (w *Worker) Run(ctx context.Context) {
	if err := w.RunOnce(ctx); err != nil && ctx.Err() == nil {
		log.Printf("mail worker: %v", err)
	}
	ticker := time.NewTicker(w.config.PollInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := w.RunOnce(ctx); err != nil && ctx.Err() == nil {
				log.Printf("mail worker: %v", err)
			}
		}
	}
}

func (w *Worker) RunOnce(ctx context.Context) error {
	tx, err := w.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin outbox batch: %w", err)
	}
	defer tx.Rollback()

	rows, err := tx.QueryContext(ctx, `
		SELECT id, kind, to_email, subject, body, ref_id, attempts
		FROM email_outbox
		WHERE status = 'pending' AND next_attempt_at <= now()
		ORDER BY id
		LIMIT $1
		FOR UPDATE SKIP LOCKED`, batchSize)
	if err != nil {
		return fmt.Errorf("load outbox batch: %w", err)
	}
	var messages []message
	for rows.Next() {
		var item message
		if err := rows.Scan(&item.id, &item.kind, &item.to, &item.subject, &item.body, &item.refID, &item.attempts); err != nil {
			rows.Close()
			return fmt.Errorf("scan outbox row: %w", err)
		}
		messages = append(messages, item)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return fmt.Errorf("read outbox batch: %w", err)
	}
	rows.Close()

	for _, item := range messages {
		if err := w.deliver(item); err != nil {
			if updateErr := recordFailure(ctx, tx, item); updateErr != nil {
				return updateErr
			}
			continue
		}
		if _, err := tx.ExecContext(ctx,
			`UPDATE email_outbox SET status='sent' WHERE id=$1`, item.id,
		); err != nil {
			return fmt.Errorf("mark email %d sent: %w", item.id, err)
		}
		if item.kind == "invoice" && item.refID.Valid {
			if _, err := tx.ExecContext(ctx,
				`UPDATE invoices SET sent_at=COALESCE(sent_at, now()) WHERE id=$1`, item.refID.Int64,
			); err != nil {
				return fmt.Errorf("mark invoice %d sent: %w", item.refID.Int64, err)
			}
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit outbox batch: %w", err)
	}
	return nil
}

func (w *Worker) deliver(item message) error {
	conn, err := net.DialTimeout("tcp", w.config.Addr, 2*time.Second)
	if err != nil {
		return err
	}
	host := smtpHost(w.config.Addr)
	client, err := smtp.NewClient(conn, host)
	if err != nil {
		_ = conn.Close()
		return err
	}
	defer client.Close()

	if w.config.Username != "" {
		if err := client.Auth(smtp.PlainAuth("", w.config.Username, w.config.Password, host)); err != nil {
			return err
		}
	}
	if err := client.Mail(w.config.From); err != nil {
		return err
	}
	if err := client.Rcpt(item.to); err != nil {
		return err
	}
	writer, err := client.Data()
	if err != nil {
		return err
	}
	if _, err := io.WriteString(writer, mimeMessage(w.config.From, item)); err != nil {
		_ = writer.Close()
		return err
	}
	return writer.Close()
}

func recordFailure(ctx context.Context, tx *sql.Tx, item message) error {
	attempts := item.attempts + 1
	status := "pending"
	if attempts >= maxAttempts {
		status = "failed"
	}
	backoffMinutes := 1 << min(attempts-1, 4)
	_, err := tx.ExecContext(ctx, `
		UPDATE email_outbox
		SET attempts=$1, status=$2, next_attempt_at=now() + ($3 * interval '1 minute')
		WHERE id=$4`, attempts, status, backoffMinutes, item.id)
	if err != nil {
		return fmt.Errorf("record email %d failure: %w", item.id, err)
	}
	return nil
}

func mimeMessage(from string, item message) string {
	return fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n%s\r\n", from, item.to, item.subject, item.body)
}

func envOrDefault(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func smtpHost(addr string) string {
	if host, _, err := net.SplitHostPort(addr); err == nil {
		return host
	}
	return strings.SplitN(addr, ":", 2)[0]
}
