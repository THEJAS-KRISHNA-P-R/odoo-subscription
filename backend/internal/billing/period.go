package billing

import "time"

// Next returns the start of the period after `from`, for a subscription whose billing anchor day is
// `anchor` (start_date.Day()). Monthly/yearly clamp to the last day of short months and snap back
// to the anchor day afterwards, so Jan 31 -> Feb 28 -> Mar 31 (no drift).
func Next(from time.Time, period string, anchor int) time.Time {
	from = time.Date(from.Year(), from.Month(), from.Day(), 0, 0, 0, 0, time.UTC)
	switch period {
	case "daily":
		return from.AddDate(0, 0, 1)
	case "weekly":
		return from.AddDate(0, 0, 7)
	case "monthly":
		return addMonthsClamped(from, 1, anchor)
	case "yearly":
		return addMonthsClamped(from, 12, anchor)
	}
	panic("billing: unknown period " + period)
}

func addMonthsClamped(t time.Time, months, anchor int) time.Time {
	first := time.Date(t.Year(), t.Month()+time.Month(months), 1, 0, 0, 0, 0, time.UTC)
	last := first.AddDate(0, 1, -1).Day()
	day := anchor
	if day > last {
		day = last
	}
	return time.Date(first.Year(), first.Month(), day, 0, 0, 0, 0, time.UTC)
}
