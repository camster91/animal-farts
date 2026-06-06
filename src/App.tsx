import KidScreen from './kid/KidScreen';
import ParentApp from './parent/ParentApp';

export default function App() {
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/parent')) {
    return <ParentApp />;
  }
  return <KidScreen />;
}
