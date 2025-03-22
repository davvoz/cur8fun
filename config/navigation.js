export const mainNavItems = [
  {
    id: 'home',
    label: 'Home',
    icon: 'home',
    path: '/',
    showInBottom: true
  },
  // {
  //   id: 'trending',
  //   label: 'Trending',
  //   icon: 'trending_up',
  //   path: '/trending',
  //   showInBottom: true
  // },
  // {
  //   id: 'hot',
  //   label: 'Hot',
  //   icon: 'whatshot',
  //   path: '/hot',
  //   showInSide: true,
  //   showInBottom: false
  // },
  {
    id: 'new',
    label: 'New',
    icon: 'new_releases',
    path: '/new',
    showInSide: true,
    showInBottom: false
  },
  // {
  //   id: 'promoted',
  //   label: 'Promoted',
  //   icon: 'rocket_launch',
  //   path: '/promoted',
  //   showInSide: true,
  //   showInBottom: false
  // },
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