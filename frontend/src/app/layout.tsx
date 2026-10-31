import "./globals.css";

export const metadata = {
  title: "Brightloop Subscription Management",
  description: "Billing engine with Wise-style UI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-gray-900">
        <header className="top-bar">
          <div className="breadcrumbs">
            <span>Home / Overview</span>
          </div>
          <div className="user-badge">
            <div className="avatar">TR</div>
            <span className="user-name">Thejas</span>
          </div>
        </header>

        <main className="app-main">
          <section className="content-canvas">
            {children}
          </section>
        </main>
      </body>
    </html>
  );
}