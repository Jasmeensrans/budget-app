import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';

export function NotFound() {
  return (
    <div className="page">
      <PageHeader title="Page not found" />
      <p>
        <Link to="/">Back to the dashboard</Link>
      </p>
    </div>
  );
}
