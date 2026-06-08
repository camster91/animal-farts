// App entry. v31 — single-route PootBox app.
// The /parent route has been removed (settings are a backdoor modal now).
// All kid interaction lives at the root URL.

import PootBox from "./pootbox/PootBox";

export default function App() {
  return <PootBox />;
}
