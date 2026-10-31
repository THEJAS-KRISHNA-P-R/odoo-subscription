package billing

import (
	"testing"
	"time"
)

// Worked example from docs/03-business-rules.md.
// Plan fee 500.00 (18% tax) + 2 x CRM (1,000.00 + 560.00 Odoo brand = 1,560.00, 18% tax),
// 10% discount on the CRM product only.
func TestWorkedExample(t *testing.T) {
	const crm = int64(7)
	lines := []Line{
		{ProductID: 0, Qty: 1, UnitMinor: 50000, TaxBP: 1800},
		{ProductID: crm, Qty: 2, UnitMinor: 100000 + 56000, TaxBP: 1800},
	}
	ten := Discount{ID: 1, Percent: true, Value: 1000, AppliesTo: func(l Line) bool { return l.ProductID == crm }}
	got := Compute(lines, []Discount{ten})
	want := Totals{Subtotal: 362000, Discount: 31200, Tax: 59544, Total: 390344}
	if got.Subtotal != want.Subtotal || got.Discount != want.Discount || got.Tax != want.Tax || got.Total != want.Total {
		t.Fatalf("got %+v want %+v", got, want)
	}
	if got.PerDiscount[1] != 31200 {
		t.Fatalf("per-discount %v", got.PerDiscount)
	}
}

func TestDiscountNeverBelowZero(t *testing.T) {
	got := Compute([]Line{{Qty: 1, UnitMinor: 1000, TaxBP: 1800}}, []Discount{{ID: 1, Value: 5000}})
	if got.Discount != 1000 || got.Total != 0 || got.Tax != 0 {
		t.Fatalf("%+v", got)
	}
}

func TestSubscriptionDiscountSplitIsExact(t *testing.T) {
	lines := []Line{{Qty: 1, UnitMinor: 333, TaxBP: 0}, {Qty: 1, UnitMinor: 333, TaxBP: 0}, {Qty: 1, UnitMinor: 334, TaxBP: 0}}
	got := Compute(lines, []Discount{{ID: 1, Value: 100}})
	var sum int64
	for _, l := range got.Lines {
		sum += l.Discount
	}
	if sum != 100 || got.Discount != 100 || got.Total != 1000-100 {
		t.Fatalf("sum=%d %+v", sum, got)
	}
}

func TestTotalsMatchDBCheck(t *testing.T) { // total = subtotal - discount + tax, always
	for q := int64(1); q < 40; q++ {
		g := Compute([]Line{{Qty: q, UnitMinor: 12345, TaxBP: 1800}, {Qty: 1, UnitMinor: 99, TaxBP: 500}},
			[]Discount{{ID: 1, Percent: true, Value: 1250}, {ID: 2, Value: 777}})
		if g.Total != g.Subtotal-g.Discount+g.Tax || g.Total < 0 {
			t.Fatalf("q=%d %+v", q, g)
		}
	}
}

func TestNextMonthlyNoDrift(t *testing.T) {
	d := func(y int, m time.Month, day int) time.Time { return time.Date(y, m, day, 0, 0, 0, 0, time.UTC) }
	a := d(2026, 1, 31)
	feb := Next(a, "monthly", 31)
	mar := Next(feb, "monthly", 31)
	if !feb.Equal(d(2026, 2, 28)) || !mar.Equal(d(2026, 3, 31)) {
		t.Fatalf("feb=%v mar=%v", feb, mar)
	}
	if !Next(d(2028, 2, 29), "yearly", 29).Equal(d(2029, 2, 28)) {
		t.Fatal("leap yearly")
	}
	if !Next(a, "weekly", 31).Equal(d(2026, 2, 7)) || !Next(a, "daily", 31).Equal(d(2026, 2, 1)) {
		t.Fatal("weekly/daily")
	}
}
