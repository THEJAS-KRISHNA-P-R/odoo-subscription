// Package billing holds the pure money math. No DB, no clock, no floats.
// Every amount is int64 minor units (paise); every rate is basis points (1% = 100).
package billing

// Line is one invoice line before discounts and tax.
type Line struct {
	ProductID int64 // 0 = plan fee line
	Qty       int64
	UnitMinor int64
	TaxBP     int64
}

// Discount is an already-selected, eligible discount (eligibility is decided by the caller).
type Discount struct {
	ID        int64
	Percent   bool              // true: Value is basis points; false: Value is minor units
	Value     int64             //
	AppliesTo func(l Line) bool // nil = whole subscription (all lines)
}

// LineResult is the computed result for one line.
type LineResult struct {
	Gross, Discount, Net, Tax int64
}

// Totals is the invoice-level result. Total = Subtotal - Discount + Tax (matches the DB CHECK).
type Totals struct {
	Lines                          []LineResult
	Subtotal, Discount, Tax, Total int64
	PerDiscount                    map[int64]int64 // discount id -> amount actually applied
}

// roundDiv returns round-half-up(n/d) for n >= 0, d > 0.
func roundDiv(n, d int64) int64 { return (n*2 + d) / (d * 2) }

// Compute applies discounts in the given order (callers sort by id), each on what is left of the
// line, never below zero, then taxes the discounted amount. Tax is rounded per line.
func Compute(lines []Line, discounts []Discount) Totals {
	t := Totals{Lines: make([]LineResult, len(lines)), PerDiscount: map[int64]int64{}}
	for i, l := range lines {
		t.Lines[i].Gross = l.Qty * l.UnitMinor
	}
	for _, d := range discounts {
		// which lines does it touch, and what is left on them
		var idx []int
		var room int64
		for i, l := range lines {
			if d.AppliesTo == nil || d.AppliesTo(l) {
				idx = append(idx, i)
				room += t.Lines[i].Gross - t.Lines[i].Discount
			}
		}
		if room <= 0 {
			continue
		}
		want := d.Value
		if d.Percent {
			want = roundDiv(room*d.Value, 10000)
		}
		if want > room {
			want = room
		}
		// spread pro-rata, remainder to the last touched line so the sum is exact
		var given int64
		for k, i := range idx {
			left := t.Lines[i].Gross - t.Lines[i].Discount
			share := want * left / room
			if k == len(idx)-1 {
				share = want - given
			}
			if share > left {
				share = left
			}
			t.Lines[i].Discount += share
			given += share
		}
		t.PerDiscount[d.ID] += given
	}
	for i, l := range lines {
		r := &t.Lines[i]
		r.Net = r.Gross - r.Discount
		r.Tax = roundDiv(r.Net*l.TaxBP, 10000)
		t.Subtotal += r.Gross
		t.Discount += r.Discount
		t.Tax += r.Tax
	}
	t.Total = t.Subtotal - t.Discount + t.Tax
	return t
}
