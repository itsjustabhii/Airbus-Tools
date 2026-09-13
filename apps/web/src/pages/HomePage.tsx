import { APP_NAME } from '@airbus-tools/shared';
import { NotificationBell } from '../components/NotificationBell';

export function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="text-xl font-bold text-gray-900">{APP_NAME}</div>
          <div className="flex items-center space-x-4">
            <NotificationBell />
          </div>
        </div>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900">{APP_NAME}</h1>
          <p className="mt-4 text-lg text-gray-600">B2B Marketplace Platform</p>
          <p className="mt-2 text-sm text-gray-400">Platform bootstrap — Phase 0</p>
        </div>
      </main>
    </div>
  );
}
