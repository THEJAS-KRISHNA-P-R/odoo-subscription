package catalog

import (
	"context"
	"database/sql"
	"fmt"
	"time"
)

type Tax struct {
	ID       int64  `json:"id"`
	Name     string `json:"name"`
	RateBP   int    `json:"rate_bp"` // basis points: 1800 = 18%
	IsActive bool   `json:"is_active"`
}

type PaymentTerm struct {
	ID      int64  `json:"id"`
	Name    string `json:"name"`
	DueDays int    `json:"due_days"`
}

type Variant struct {
	ID              int64  `json:"id"`
	ProductID       int64  `json:"product_id"`
	Attribute       string `json:"attribute"`
	Value           string `json:"value"`
	ExtraPriceMinor int64  `json:"extra_price_minor"`
}

type Product struct {
	ID              int64     `json:"id"`
	Name            string    `json:"name"`
	Type            string    `json:"type"`
	SalesPriceMinor int64     `json:"sales_price_minor"`
	CostPriceMinor  int64     `json:"cost_price_minor"`
	TaxID           *int64    `json:"tax_id"`
	TaxName         *string   `json:"tax_name,omitempty"`
	TaxRateBP       *int      `json:"tax_rate_bp,omitempty"`
	Notes           string    `json:"notes"`
	IsActive        bool      `json:"is_active"`
	Variants        []Variant `json:"variants"`
	CreatedAt       time.Time `json:"created_at"`
}

type Store struct {
	db *sql.DB
}

func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

// Taxes
func (s *Store) ListTaxes(ctx context.Context) ([]Tax, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, name, rate_bp, is_active FROM taxes ORDER BY id ASC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []Tax
	for rows.Next() {
		var t Tax
		if err := rows.Scan(&t.ID, &t.Name, &t.RateBP, &t.IsActive); err != nil {
			return nil, err
		}
		list = append(list, t)
	}
	return list, rows.Err()
}

func (s *Store) CreateTax(ctx context.Context, name string, rateBP int) (int64, error) {
	var id int64
	err := s.db.QueryRowContext(ctx,
		`INSERT INTO taxes (name, rate_bp, is_active) VALUES ($1, $2, true) RETURNING id`,
		name, rateBP,
	).Scan(&id)
	return id, err
}

func (s *Store) UpdateTax(ctx context.Context, id int64, name string, rateBP *int, isActive *bool) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE taxes
		 SET name = COALESCE(NULLIF($1, ''), name),
		     rate_bp = COALESCE($2, rate_bp),
		     is_active = COALESCE($3, is_active)
		 WHERE id = $4`,
		name, rateBP, isActive, id,
	)
	return err
}

// Payment Terms
func (s *Store) ListPaymentTerms(ctx context.Context) ([]PaymentTerm, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, name, due_days FROM payment_terms ORDER BY due_days ASC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []PaymentTerm
	for rows.Next() {
		var pt PaymentTerm
		if err := rows.Scan(&pt.ID, &pt.Name, &pt.DueDays); err != nil {
			return nil, err
		}
		list = append(list, pt)
	}
	return list, rows.Err()
}

func (s *Store) CreatePaymentTerm(ctx context.Context, name string, dueDays int) (int64, error) {
	var id int64
	err := s.db.QueryRowContext(ctx,
		`INSERT INTO payment_terms (name, due_days) VALUES ($1, $2) RETURNING id`,
		name, dueDays,
	).Scan(&id)
	return id, err
}

func (s *Store) UpdatePaymentTerm(ctx context.Context, id int64, name string, dueDays *int) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE payment_terms
		 SET name = COALESCE(NULLIF($1, ''), name),
		     due_days = COALESCE($2, due_days)
		 WHERE id = $3`,
		name, dueDays, id,
	)
	return err
}

// Products
func (s *Store) ListProducts(ctx context.Context, typ string, isActive *bool, cursor int64, limit int) ([]Product, error) {
	if limit <= 0 {
		limit = 25
	}
	if limit > 100 {
		limit = 100
	}
	if cursor < 0 {
		return nil, fmt.Errorf("cursor must not be negative")
	}

	query := `
		SELECT p.id, p.name, p.type, p.sales_price_minor, p.cost_price_minor,
		       p.tax_id, t.name, t.rate_bp, COALESCE(p.notes, ''), p.is_active, p.created_at
		FROM products p
		LEFT JOIN taxes t ON p.tax_id = t.id
		WHERE ($1::text IS NULL OR p.type = $1)
		  AND ($2::boolean IS NULL OR p.is_active = $2)
		  AND ($3::bigint = 0 OR p.id < $3)
		ORDER BY p.id DESC
		LIMIT $4
	`
	var typParam *string
	if typ != "" {
		typParam = &typ
	}

	rows, err := s.db.QueryContext(ctx, query, typParam, isActive, cursor, limit+1)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var products []Product
	for rows.Next() {
		var p Product
		var taxName sql.NullString
		var taxRate sql.NullInt64
		if err := rows.Scan(
			&p.ID, &p.Name, &p.Type, &p.SalesPriceMinor, &p.CostPriceMinor,
			&p.TaxID, &taxName, &taxRate, &p.Notes, &p.IsActive, &p.CreatedAt,
		); err != nil {
			return nil, err
		}
		if taxName.Valid {
			p.TaxName = &taxName.String
		}
		if taxRate.Valid {
			rate := int(taxRate.Int64)
			p.TaxRateBP = &rate
		}
		products = append(products, p)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if len(products) > 0 {
		ids := make([]int64, 0, len(products))
		for _, p := range products {
			ids = append(ids, p.ID)
		}
		vRows, err := s.db.QueryContext(ctx,
			`SELECT id, product_id, attribute, value, extra_price_minor
			 FROM product_variants
			 WHERE product_id = ANY($1)
			 ORDER BY id ASC`,
			ids,
		)
		if err != nil {
			return nil, err
		}
		defer vRows.Close()
		vMap := make(map[int64][]Variant)
		for vRows.Next() {
			var v Variant
			if err := vRows.Scan(&v.ID, &v.ProductID, &v.Attribute, &v.Value, &v.ExtraPriceMinor); err != nil {
				return nil, err
			}
			vMap[v.ProductID] = append(vMap[v.ProductID], v)
		}
		if err := vRows.Err(); err != nil {
			return nil, err
		}
		for i := range products {
			if vars, ok := vMap[products[i].ID]; ok {
				products[i].Variants = vars
			} else {
				products[i].Variants = []Variant{}
			}
		}
	}

	return products, nil
}

func (s *Store) GetProduct(ctx context.Context, id int64) (*Product, error) {
	var p Product
	var taxName sql.NullString
	var taxRate sql.NullInt64

	err := s.db.QueryRowContext(ctx,
		`SELECT p.id, p.name, p.type, p.sales_price_minor, p.cost_price_minor,
		       p.tax_id, t.name, t.rate_bp, COALESCE(p.notes, ''), p.is_active, p.created_at
		 FROM products p
		 LEFT JOIN taxes t ON p.tax_id = t.id
		 WHERE p.id = $1`,
		id,
	).Scan(
		&p.ID, &p.Name, &p.Type, &p.SalesPriceMinor, &p.CostPriceMinor,
		&p.TaxID, &taxName, &taxRate, &p.Notes, &p.IsActive, &p.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	if taxName.Valid {
		p.TaxName = &taxName.String
	}
	if taxRate.Valid {
		r := int(taxRate.Int64)
		p.TaxRateBP = &r
	}

	// Fetch variants
	vRows, err := s.db.QueryContext(ctx,
		`SELECT id, product_id, attribute, value, extra_price_minor
		 FROM product_variants
		 WHERE product_id = $1
		 ORDER BY id ASC`,
		id,
	)
	p.Variants = []Variant{}
	if err != nil {
		return nil, err
	}
	defer vRows.Close()
	for vRows.Next() {
		var v Variant
		if err := vRows.Scan(&v.ID, &v.ProductID, &v.Attribute, &v.Value, &v.ExtraPriceMinor); err != nil {
			return nil, err
		}
		p.Variants = append(p.Variants, v)
	}
	if err := vRows.Err(); err != nil {
		return nil, err
	}
	return &p, nil
}

func (s *Store) CreateProduct(ctx context.Context, name, typ string, salesMinor, costMinor int64, taxID *int64, notes string) (int64, error) {
	var id int64
	err := s.db.QueryRowContext(ctx,
		`INSERT INTO products (name, type, sales_price_minor, cost_price_minor, tax_id, notes, is_active)
		 VALUES ($1, $2, $3, $4, $5, $6, true)
		 RETURNING id`,
		name, typ, salesMinor, costMinor, taxID, notes,
	).Scan(&id)
	return id, err
}

func (s *Store) UpdateProduct(ctx context.Context, id int64, name, typ string, salesMinor, costMinor *int64, taxID *int64, notes *string, isActive *bool) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE products
		 SET name = COALESCE(NULLIF($1, ''), name),
		     type = COALESCE(NULLIF($2, ''), type),
		     sales_price_minor = COALESCE($3, sales_price_minor),
		     cost_price_minor = COALESCE($4, cost_price_minor),
		     tax_id = COALESCE($5, tax_id),
		     notes = COALESCE($6, notes),
		     is_active = COALESCE($7, is_active)
		 WHERE id = $8`,
		name, typ, salesMinor, costMinor, taxID, notes, isActive, id,
	)
	return err
}

func (s *Store) DeleteProduct(ctx context.Context, id int64) error {
	// Soft delete by setting is_active = false
	_, err := s.db.ExecContext(ctx, `UPDATE products SET is_active = false WHERE id = $1`, id)
	return err
}

// Variants
func (s *Store) ListVariants(ctx context.Context, productID int64) ([]Variant, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, product_id, attribute, value, extra_price_minor
		 FROM product_variants
		 WHERE product_id = $1
		 ORDER BY id ASC`,
		productID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []Variant
	for rows.Next() {
		var v Variant
		if err := rows.Scan(&v.ID, &v.ProductID, &v.Attribute, &v.Value, &v.ExtraPriceMinor); err != nil {
			return nil, err
		}
		list = append(list, v)
	}
	return list, rows.Err()
}

func (s *Store) CreateVariant(ctx context.Context, productID int64, attribute, value string, extraPrice int64) (int64, error) {
	var id int64
	err := s.db.QueryRowContext(ctx,
		`INSERT INTO product_variants (product_id, attribute, value, extra_price_minor)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id`,
		productID, attribute, value, extraPrice,
	).Scan(&id)
	return id, err
}

func (s *Store) UpdateVariant(ctx context.Context, id int64, value string, extraPrice *int64) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE product_variants
		 SET value = COALESCE(NULLIF($1, ''), value),
		     extra_price_minor = COALESCE($2, extra_price_minor)
		 WHERE id = $3`,
		value, extraPrice, id,
	)
	return err
}

func (s *Store) UpdateVariantForProduct(ctx context.Context, productID, id int64, value string, extraPrice *int64) error {
	result, err := s.db.ExecContext(ctx,
		`UPDATE product_variants
		 SET value = COALESCE(NULLIF($1, ''), value),
		     extra_price_minor = COALESCE($2, extra_price_minor)
		 WHERE id = $3 AND product_id = $4`,
		value, extraPrice, id, productID,
	)
	if err != nil {
		return err
	}
	if count, err := result.RowsAffected(); err != nil {
		return err
	} else if count == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (s *Store) DeleteVariant(ctx context.Context, id int64) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM product_variants WHERE id = $1`, id)
	return err
}

func (s *Store) DeleteVariantForProduct(ctx context.Context, productID, id int64) error {
	result, err := s.db.ExecContext(ctx,
		`DELETE FROM product_variants WHERE id = $1 AND product_id = $2`, id, productID,
	)
	if err != nil {
		return err
	}
	if count, err := result.RowsAffected(); err != nil {
		return err
	} else if count == 0 {
		return sql.ErrNoRows
	}
	return nil
}
