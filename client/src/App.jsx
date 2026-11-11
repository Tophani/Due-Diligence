import { Navigate, Routes, Route } from 'react-router-dom';
import RequireAuth from './components/RequireAuth.jsx';
import AuthProvider from './context/AuthProvider.jsx';
import AdminLayout from './layouts/AdminLayout.jsx';
import VendorLayout from './layouts/VendorLayout.jsx';
import AdminSimpleHome from './pages/admin/AdminSimpleHome.jsx';
import AdminSimpleOrg from './pages/admin/AdminSimpleOrg.jsx';
import AdminSimpleSetup from './pages/admin/AdminSimpleSetup.jsx';
import SignIn from './pages/SignIn.jsx';
import VendorSimpleForm from './pages/vendor/VendorSimpleForm.jsx';
import VendorSimpleStart from './pages/vendor/VendorSimpleStart.jsx';
import VendorSimpleStatus from './pages/vendor/VendorSimpleStatus.jsx';
import VendorSimpleSubmit from './pages/vendor/VendorSimpleSubmit.jsx';

function NotFound() {
  return (
    <div className="min-h-screen bg-sand-50 flex items-center justify-center">
      <h1 className="text-24 font-semibold">Page not found</h1>
    </div>
  );
}

/** Routes from due-diligence-final/FINAL.md. Sign-in decides which portal you see. */
function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/signin" element={<SignIn />} />
        <Route path="/register" element={<SignIn />} />

        {/* Vendor */}
        <Route
          element={
            <RequireAuth roles={['vendor']}>
              <VendorLayout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<VendorSimpleStart />} />
          <Route path="/form/:section" element={<VendorSimpleForm />} />
          <Route path="/form" element={<Navigate to="/form/1" replace />} />
          <Route path="/submit" element={<VendorSimpleSubmit />} />
          <Route path="/submitted" element={<VendorSimpleStatus />} />
        </Route>

        {/* Staff */}
        <Route
          path="/admin"
          element={
            <RequireAuth roles={['reviewer', 'admin']}>
              <AdminLayout />
            </RequireAuth>
          }
        >
          <Route index element={<AdminSimpleHome />} />
          <Route path="organisations" element={<AdminSimpleHome />} />
          <Route path="organisations/:id" element={<AdminSimpleOrg />} />
          <Route path="setup" element={<AdminSimpleSetup />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
