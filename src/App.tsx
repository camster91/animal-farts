import KidScreen from './kid/KidScreen';

export default function App() {
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/parent')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-amber-50">
        <div className="text-center">
          <div className="text-6xl mb-4">💨</div>
          <h1 className="text-2xl font-bold text-amber-900">Poot Party</h1>
          <p className="text-amber-700 mt-2">Operator dashboard — coming in v26c</p>
        </div>
      </div>
    );
  }
  return <KidScreen />;
}
