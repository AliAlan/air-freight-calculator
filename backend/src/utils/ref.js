// Generates a human-friendly shipment reference, e.g. AF-7F3A21.
module.exports.makeRef = () =>
  'AF-' + Math.random().toString(16).slice(2, 8).toUpperCase();
