// Route builders, so links stay consistent across the app (routes from due-diligence-final/FINAL.md).

export const itemAnchor = (ref) => `item-${ref.replace(/\./g, '-')}`;

export const vendorRoutes = {
  dashboard: () => '/',
  section: (n, itemRef) => `/form/${n}` + (itemRef ? `#${itemAnchor(itemRef)}` : ''),
  review: () => '/submit',
  status: () => '/submitted',
};

export const adminRoutes = {
  dashboard: () => '/admin',
  organisation: (id) => `/admin/organisations/${id}`,
  setup: () => '/admin/setup',
};
