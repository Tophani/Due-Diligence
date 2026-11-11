import { Outlet } from 'react-router-dom';
import VendorApiProvider from '../context/VendorApiProvider.jsx';

/**
 * Vendor shell (due-diligence-final/vendor): sand page, one centred 680px column, no navigation.
 * The signed-in vendor's assessment is loaded from the server here, for every vendor page.
 */
export default function VendorLayout() {
  return (
    <div className="min-h-screen bg-sand-50 text-15 leading-[1.55] px-4 pt-8 pb-16">
      <div className="max-w-[680px] mx-auto flex flex-col gap-3.5">
        <VendorApiProvider>
          <Outlet />
        </VendorApiProvider>
      </div>
    </div>
  );
}
