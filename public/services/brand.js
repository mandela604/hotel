/* Hotel brand — single source for customer-facing headers/receipts.
   Reads /api/settings (Config) with hardcoded fallback so receipts never
   render blank. Edit name/address/contacts in Settings → Platform. */
(function (global) {
  'use strict';
  var FALLBACK = {
    hotelName: 'Boston Leisure Hotel and Apartments',
    hotelAddress: 'Idi Close, Km 75, Auchi-Benin Expressway, Ujoelen, Ekpoma, Edo State',
    hotelPhone: '09039391464',
    hotelEmail: 'hr.bostonleisurehotel@gmail.com',
  };
  var cache = null, pending = null;
  function normalize(cfg) {
    cfg = cfg || {};
    var name = cfg.hotelName || FALLBACK.hotelName;
    return {
      hotelName: name,
      hotelNameUpper: String(name).toUpperCase(),
      hotelAddress: cfg.hotelAddress || FALLBACK.hotelAddress,
      hotelPhone: cfg.hotelPhone || FALLBACK.hotelPhone,
      hotelEmail: cfg.hotelEmail || FALLBACK.hotelEmail,
      contactLine: (cfg.hotelPhone || FALLBACK.hotelPhone) + ' / ' + (cfg.hotelEmail || FALLBACK.hotelEmail),
    };
  }
  function get() {
    if (cache) return Promise.resolve(cache);
    if (pending) return pending;
    pending = fetch('/api/settings', { credentials: 'include' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { cache = normalize(j && j.data ? j.data : null); return cache; })
      .catch(function () { cache = normalize(null); return cache; })
      .finally(function () { pending = null; });
    return pending;
  }
  function prefetch() { get(); }
  global.HotelBrand = { get: get, prefetch: prefetch, fallback: normalize(null) };
})(window);
