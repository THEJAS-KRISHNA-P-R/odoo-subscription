export default function HomePage() {
  return (
    <div className="max-w-1200 mx-auto py-40 px-40 gap-40">
      {/* Hero Banner */}
      <section className="bento-hero">
        <div>
          <h2 className="bento-hero__title">Brightloop Subscription Management</h2>
          <p className="bento-hero__subtitle">Calm, spaced, and bento-grid styled billing engine</p>
        </div>
      </section>

      {/* Metric & Actions Bento */}
      <section className="bento-grid">
        <div className="bento-account-card">
          <span className="bento-account-card__label">Active Subscriptions</span>
          <span className="bento-account-card__amount">5,243</span>
          <button className="pill-btn pill-btn--soft" style="align-self: flex-start;">
            <span>View Details</span>
            <span className="material-symbols-outlined">expand_more</span>
          </button>
        </div>

        <div className="bento-card bento-card--action">
          <h3>Do more with your money</h3>
          <p>Manage, configure, and schedule billing</p>
          <div className="circle-action-btn">+</div>
        </div>
      </section>

      {/* Dashed Action Cards (2-Column Grid) */}
      <section className="section-block">
        <h3 className="section-title">Outgoing</h3>
        <div className="grid-two-column">
          <div className="dashed-action-card">
            <div className="dashed-action-card__icon-wrapper">
              <span className="material-symbols-outlined">receipt_long</span>
              <span className="plus-badge">+</span>
            </div>
            <div className="dashed-action-card__content">
              <span className="dashed-action-card__title">Record Payment</span>
              <span className="dashed-action-card__desc">Upload or email payments, sync with accounting.</span>
            </div>
            <span className="material-symbols-outlined chevron">chevron_right</span>
          </div>

          <div className="dashed-action-card">
            <div className="dashed-action-card__icon-wrapper">
              <span className="material-symbols-outlined">event_repeat</span>
              <span className="plus-badge">+</span>
            </div>
            <div className="dashed-action-card__content">
              <span className="dashed-action-card__title">Run Billing</span>
              <span className="dashed-action-card__desc">Auto-generate invoices for active subscriptions.</span>
            </div>
            <span className="material-symbols-outlined chevron">chevron_right</span>
          </div>
        </div>
      </section>
    </div>
  );
}