import { APP_NAME } from '@airbus-tools/shared';

export function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900">{APP_NAME}</h1>
        <p className="mt-4 text-lg text-gray-600">B2B Marketplace Platform</p>
        <p className="mt-2 text-sm text-gray-400">Platform bootstrap — Phase 0</p>
      </div>
    </main>
  );
}
