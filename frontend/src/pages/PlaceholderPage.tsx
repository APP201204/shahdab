import { useLocation } from 'react-router-dom';

const titles: Record<string, string> = {
  '/': 'Dashboard',
  '/table-service': 'Table Service',
  '/quick-order': 'Quick Order',
  '/kitchen': 'Kitchen Display',
  '/delivery': 'Delivery',
  '/tables': 'Table Management',
  '/menu': 'Menu Management',
  '/sections': 'Sections',
  '/billing-stations': 'Billing Stations',
  '/reports': 'Reports',
};

export function PlaceholderPage() {
  const location = useLocation();
  const title = titles[location.pathname] || 'Page';

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold text-gray-900 mb-4">{title}</h1>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
        <p className="text-gray-500">This page is coming soon.</p>
      </div>
    </div>
  );
}
