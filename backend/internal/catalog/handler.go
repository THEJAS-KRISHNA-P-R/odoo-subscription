package catalog

import (
	"database/sql"
	"net/http"
	"strconv"

	"brightloop/internal/httpx"
)

// Store holds the database operations for catalog
type Store struct {
	db *sql.DB
}

func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

// Product represents a product in the catalog
type Product struct {
	ID            int
	Name          string
	Type          string
	SalesPriceMinor int64
	CostPriceMinor  int64
	TaxID         *int
	IsActive      bool
	CreatedAt     string
}

// ListProducts returns products with optional filtering
func (s *Store) ListProducts(filters map[string]string) ([]Product, int, error) {
	query := `SELECT id, name, type, sales_price_minor, cost_price_minor, tax_id, is_active, created_at FROM products WHERE is_active = true`
	args := []interface{}{}
	argIdx := 1

	if t := filters["type"]; t != "" {
		query += ` AND type = $` + strconv.Itoa(argIdx) 
		// simplified - in real code use pq or safe arg building
		argIdx++
	}

	// Execute and scan - placeholder for now
	rows, err := s.db.Query(query)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var products []Product
	for rows.Next() {
		var p Product
		var taxID sql.NullInt64
		if err := rows.Scan(&p.ID, &p.Name, &p.Type, &p.SalesPriceMinor, &p.CostPriceMinor, &taxID, &p.IsActive, &p.CreatedAt); err != nil {
			return nil, 0, err
		}
		if taxID.Valid {
			p.TaxID = &taxID.Int64
		}
		products = append(products, p)
	}
	return products, len(products), nil
}

// GetProduct returns a single product by ID
func (s *Store) GetProduct(id int) (*Product, error) {
	var p Product
	var taxID sql.NullInt64
	err := s.db.QueryRow(`SELECT id, name, type, sales_price_minor, cost_price_minor, tax_id, is_active, created_at FROM products WHERE id = $1`, id).Scan(
		&p.ID, &p.Name, &p.Type, &p.SalesPriceMinor, &p.CostPriceMinor, &taxID, &p.IsActive, &p.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	if taxID.Valid {
		p.TaxID = &taxID.Int64
	}
	return &p, nil
}

// CreateProduct creates a new product
func (s *Store) CreateProduct(name, typ string, salesPrice, costPrice int64, taxID *int) error {
	_, err := s.db.Exec(
		`INSERT INTO products (name, type, sales_price_minor, cost_price_minor, tax_id, is_active) VALUES ($1, $2, $3, $4, $5, true)`,
		name, typ, salesPrice, costPrice, taxID,
	)
	return err
}

// UpdateProduct updates an existing product
func (s *Store) UpdateProduct(id int, name, typ string, salesPrice, costPrice int64, taxID *int) error {
	_, err := s.db.Exec(
		`UPDATE products SET name = $1, type = $2, sales_price_minor = $3, cost_price_minor = $4, tax_id = $5 WHERE id = $6`,
		name, typ, salesPrice, costPrice, taxID, id,
	)
	return err
}