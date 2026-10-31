package discounts

import "testing"

func TestParseIDArray(t *testing.T) {
	got, err := parseIDArray(`[3, 8]`)
	if err != nil {
		t.Fatalf("parse id array: %v", err)
	}
	if len(got) != 2 || got[0] != 3 || got[1] != 8 {
		t.Fatalf("unexpected ids: %#v", got)
	}

	empty, err := parseIDArray(`[]`)
	if err != nil {
		t.Fatalf("parse empty id array: %v", err)
	}
	if empty == nil || len(empty) != 0 {
		t.Fatalf("expected non-nil empty ids, got %#v", empty)
	}
}
