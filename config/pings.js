// Pings: microblogging on Steem.
// Every day python/pings_wall.py publishes a root "wall" post from WALL_ACCOUNT
// in the cur8 community; each ping is a top-level reply to the latest wall,
// and replies to a ping are regular nested comments.
export const PINGS_CONFIG = {
  label: 'Pings',
  path: '/pings',
  icon: 'bolt',

  // Account that publishes the daily wall (any root post by it is a wall)
  wallAccount: 'micro.cur8',
  community: 'hive-159863',

  // Text limit, not counting images (Steem itself has no limit)
  maxLength: 280,
  maxImages: 4,

  // json_metadata markers
  pingType: 'ping',
  pingTag: 'pings',

  // Feed paging: one page = one wall (≈ one day); keep loading walls
  // until at least minItemsPerLoad pings are shown or walls run out
  wallsPerRequest: 5,
  minItemsPerLoad: 10
};
