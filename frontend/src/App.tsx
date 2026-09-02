import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { useAuthStore } from './stores/authStore';

const routes = [
  '/',
  '/table-service',
  '/quick-order',
  '/kitchen',
  '/delivery',
  '/tables',
  '/menu',
  '/sections',
  '/billing-stations',
  '/reports',
];

function AppRoutes() {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (!user && location.pathname !== '/login') {
    return <Navigate to="/login" replace />;
  }

  if (location.pathname === '/login') {
    return user ? <Navigate to="/" replace /> : <Login />;
  }

  return (
    <Layout>
      <Routes>
        {routes.map((path) => (
          <Route key={path} path={path} element={<PlaceholderPage />} />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

function App() {
  return <AppRoutes />;
}

export default App;
