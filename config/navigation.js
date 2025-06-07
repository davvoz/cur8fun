export const mainNavItems = [
  {
    id: 'home',
    label: 'Home',
    icon: 'home',
    path: '/',
    showInBottom: true,
    showInSide: true
  },
  {
    id: 'communities',
    label: 'Communities',
    icon: 'groups',
    path: '/communities',
    showInBottom: true,
    showInSide: true
  },  {
    id: 'new',
    label: 'New',
    icon: 'new_releases',
    path: '/new',
    showInSide: true,
    showInBottom: false
  },
  {
    id: 'drafts',
    label: 'Drafts',
    icon: 'draft',
    path: '/drafts',
    showInSide: true,
    showInBottom: false,
    requiresAuth: true
  },
  {
    id: 'wallet',
    label: 'Wallet',
    icon: 'account_balance_wallet',
    path: '/wallet',
    showInBottom: true,
    showInSide: true
  },
  {
    id: 'menu',
    label: 'Menu',
    icon: 'menu',
    path: '/menu',
    showInBottom: true,
    mobileOnly: true
  }
];

export const specialItems = [
  {
    id: 'create',
    label: 'Post',
    icon: 'add_circle',
    path: '/create',
    showInBottom: true,
    isAction: true,
    centerPosition: true // Make sure this property is set
  }
];