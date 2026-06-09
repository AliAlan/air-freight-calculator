/**
 * scenarios.js — Five realistic IMPORT shipment scenarios (into KSA, SAR).
 * Each demonstrates a different branch of the engine. Destination is always SA.
 */
module.exports = [
  {
    ref: 'AF-1001',
    title: 'Standard Express Shipment',
    description: 'Germany → Saudi Arabia. Volumetric (24 kg) beats actual (18 kg).',
    originCountry: 'DE', destinationCountry: 'SA', mode: 'Express',
    dangerousGoods: false, remoteArea: false, currency: 'SAR', declaredValue: 4200,
    items: [{ quantity: 1, lengthCm: 60, widthCm: 40, heightCm: 50, weightKg: 18 }],
  },
  {
    ref: 'AF-1002',
    title: 'Dangerous Goods Shipment',
    description: 'China → Saudi Arabia. DG surcharge + mandatory manual approval.',
    originCountry: 'CN', destinationCountry: 'SA', mode: 'DangerousGoods',
    dangerousGoods: true, remoteArea: false, currency: 'SAR', declaredValue: 6800,
    items: [{ quantity: 1, lengthCm: 40, widthCm: 30, heightCm: 30, weightKg: 22 }],
  },
  {
    ref: 'AF-1003',
    title: 'Oversized / Beyond-Limit Shipment',
    description: 'USA → Saudi Arabia. A 320 cm edge exceeds DHL max → rejection / special approval.',
    originCountry: 'US', destinationCountry: 'SA', mode: 'Express',
    dangerousGoods: false, remoteArea: false, currency: 'SAR', declaredValue: 9000,
    items: [{ quantity: 1, lengthCm: 320, widthCm: 60, heightCm: 60, weightKg: 55 }],
  },
  {
    ref: 'AF-1004',
    title: 'Remote Area Shipment',
    description: 'Australia (remote) → Saudi Arabia. Remote-area surcharge applies.',
    originCountry: 'AU', destinationCountry: 'SA', mode: 'Express',
    dangerousGoods: false, remoteArea: false, currency: 'SAR', declaredValue: 2600,
    items: [{ quantity: 1, lengthCm: 50, widthCm: 40, heightCm: 40, weightKg: 14 }],
  },
  {
    ref: 'AF-1005',
    title: 'Multi-piece Shipment',
    description: 'China → Saudi Arabia, Eco. Chargeable weight aggregated across 3 pieces.',
    originCountry: 'CN', destinationCountry: 'SA', mode: 'Eco',
    dangerousGoods: false, remoteArea: false, currency: 'SAR', declaredValue: 5400,
    items: [
      { quantity: 1, lengthCm: 50, widthCm: 40, heightCm: 30, weightKg: 9 },
      { quantity: 1, lengthCm: 60, widthCm: 50, heightCm: 40, weightKg: 11 },
      { quantity: 1, lengthCm: 45, widthCm: 35, heightCm: 35, weightKg: 7 },
    ],
  },
];
