// a3spy.pages.dev, the short link: every request (WebSocket upgrades too) goes to the
// a3spy Worker through the APP service binding (../wrangler.jsonc). The Worker builds
// links from the request's origin, so rooms opened here share pages.dev links.
export default {
  fetch: (request, env) => env.APP.fetch(request),
};
