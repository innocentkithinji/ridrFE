// Live queries carry Readings only, so every Alerts query polls to stay
// current.
export const alertsPollMs = 15_000;
