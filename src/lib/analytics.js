// The analytics embed (drewhoover.com/embed/analytics.js) is third-party and
// blockable, hence optional-chained. Event names are lowercase with a `from`.
export const track = (name, props) => {
  try { window.dhAnalytics?.track(name, props); } catch {}
};
