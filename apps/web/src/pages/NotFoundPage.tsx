import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-300">404</h1>
        <h2 className="mt-4 text-2xl font-semibold text-gray-800">Page Not Found</h2>
        <p className="mt-2 text-gray-500">The page you are looking for does not exist.</p>
        <Link
          to="/"
          className="mt-6 inline-block rounded-md bg-primary-600 px-6 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          Go Home
        </Link>
      </div>
    </main>
  );
}
