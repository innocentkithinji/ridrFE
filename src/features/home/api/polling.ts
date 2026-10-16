// Device health changes on a 15-minute scale, so faster polling only adds
// load.
export const healthRefetchMs = 60_000;
