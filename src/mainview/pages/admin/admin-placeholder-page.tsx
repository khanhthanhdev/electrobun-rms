interface AdminPlaceholderPageProps {
  description: string;
  title: string;
}

export const AdminPlaceholderPage = ({
  description,
  title,
}: AdminPlaceholderPageProps): JSX.Element => (
  <main className="page-shell page-shell--center">
    <div className="card surface-card surface-card--small stack stack--compact">
      <h2 className="app-heading app-heading--center">{title}</h2>
      <p className="app-subheading app-subheading--center">{description}</p>
      <div>
        <a className="button" href="/">
          Back to Home
        </a>
      </div>
    </div>
  </main>
);
