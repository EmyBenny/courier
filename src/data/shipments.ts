export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface ParcelHistoryEvent {
  id: string;
  date: string;
  localTime: string;
  utcTime: string;
  hubCode: string;
  location: string;
  title: string;
  explanation: string;
  scanCode: string;
  completed: boolean;
  isCurrent?: boolean;
}

export interface TrackableParcel {
  waybill: string;
  status: string;
  statusExplanation: string;
  nextAction: string;
  currentStageIndex: number; // 0..4
  originCity: string;
  originFacility: string;
  originCode: string;
  originPosition: GeoPoint;
  currentPosition: GeoPoint;
  currentLocationLabel: string;
  currentLocationDetails: string;
  activeGroundOrigin: GeoPoint;
  activeGroundOriginLabel: string;
  destinationCity: string;
  destinationAddress: string;
  destinationCode: string;
  destinationPosition: GeoPoint;
  service: string;
  incoterms: string;
  weight: string;
  dimensions: string;
  pieceCount: string;
  flightRef: string;
  customsEntryRef: string;
  customsStatus: string;
  securitySeal: string;
  handlingProtocol: string;
  shipper: string;
  recipient: string;
  dispatchedDate: string;
  estimatedDelivery: string;
  history: ParcelHistoryEvent[];
}

export const TRANSIT_STAGES = [
  'Collection',
  'Export Customs',
  'Air Uplift',
  'Import Clearance',
  'Final-Mile Handoff',
] as const;

export const INITIAL_PARCELS: TrackableParcel[] = [
  {
    waybill: 'GLC-729041',
    status: 'Out for Final-Mile Delivery',
    statusExplanation:
      'Your diplomatic and commercial express parcel (3.2 kg) cleared U.S. Customs & Border Protection automated release at New York JFK at 06:55 EST after arriving from Frankfurt on widebody freighter GC-108. It has completed destination sortation and is currently aboard Courier Route NY-14 in Midtown Manhattan for named-recipient signature delivery today.',
    nextAction:
      'Uniformed courier will present tamper-evident seal #SEAL-FRA-99412 for signature verification at 450 Lexington Ave before 14:15 EST.',
    currentStageIndex: 4,
    originCity: 'Frankfurt, Germany',
    originFacility: 'Frankfurt CargoCity South · Gate 14',
    originCode: 'FRA',
    originPosition: { lat: 50.0379, lng: 8.5622 },
    currentPosition: { lat: 40.758, lng: -73.9855 },
    currentLocationLabel: 'Courier Route NY-14 · Times Square / W 46th St',
    currentLocationDetails:
      'Active Midtown Manhattan courier van (#GC-NY14) proceeding eastbound toward Lexington Ave.',
    activeGroundOrigin: { lat: 40.758, lng: -73.9855 },
    activeGroundOriginLabel: 'Courier Van #GC-NY14 (Midtown West, NY)',
    destinationCity: 'New York, United States',
    destinationAddress: '450 Lexington Ave, Suite 2200, Midtown Manhattan, NY 10017',
    destinationCode: 'JFK',
    destinationPosition: { lat: 40.7529, lng: -73.9749 },
    service: 'Diplomatic & Commercial Express',
    incoterms: 'DDP · Duties & Taxes Pre-Paid',
    weight: '3.2 kg (7.05 lbs)',
    dimensions: '38 × 28 × 12 cm',
    pieceCount: '1 Sealed Security Satchel',
    flightRef: 'Flight GC-108 · Boeing 777F',
    customsEntryRef: 'CBP-AE-884920-NY',
    customsStatus: 'Released · Automated Commercial Environment (ACE)',
    securitySeal: 'SEAL-FRA-99412',
    handlingProtocol: 'Named-Signer Verification · Tamper-Evident Diplomatic Pouch',
    shipper: 'Kanzlei Weber & Partner GmbH (Frankfurt am Main)',
    recipient: 'Attn: Legal Filing Desk · Thornton & Vance LLP',
    dispatchedDate: '18 Nov 2026 · 15:10 CET',
    estimatedDelivery: 'Today · By 14:15 EST',
    history: [
      {
        id: '729-1',
        date: '18 Nov 2026',
        localTime: '15:10 CET',
        utcTime: '14:10 UTC',
        hubCode: 'FRA-CTY',
        location: 'Opernplatz Collection Point, Frankfurt, DE',
        title: 'Origin Courier Collection & Seal Applied',
        explanation:
          'Parcel collected directly from shipper reception. Commercial pro-forma invoice and diplomatic pouch manifest verified, weighed at 3.2 kg, and locked under tamper-evident seal #SEAL-FRA-99412.',
        scanCode: 'COL-904',
        completed: true,
      },
      {
        id: '729-2',
        date: '18 Nov 2026',
        localTime: '17:40 CET',
        utcTime: '16:40 UTC',
        hubCode: 'FRA-HUB',
        location: 'Frankfurt CargoCity South Bonded Terminal, DE',
        title: 'Bonded Hub Intake & Dual-View X-Ray Screening',
        explanation:
          'Passed aviation security screening without anomaly and staged into priority Unit Load Device (ULD-PMC-4412) reserved for North Atlantic express departure.',
        scanCode: 'SEC-312',
        completed: true,
      },
      {
        id: '729-3',
        date: '18 Nov 2026',
        localTime: '19:05 CET',
        utcTime: '18:05 UTC',
        hubCode: 'FRA-EXP',
        location: 'German Federal Customs Electronic Desk, FRA',
        title: 'Export Declaration Cleared & Pre-Filed to US CBP',
        explanation:
          'AES export release authorized and Harmonized System documents transmitted electronically to New York JFK customs officers prior to aircraft pushback.',
        scanCode: 'EXP-518',
        completed: true,
      },
      {
        id: '729-4',
        date: '18 Nov 2026',
        localTime: '22:30 CET',
        utcTime: '21:30 UTC',
        hubCode: 'GC-108',
        location: 'Frankfurt Airport Runway 18 → New York JFK',
        title: 'Widebody Freighter Departed',
        explanation:
          'Loaded onto dedicated cargo flight GC-108 (Boeing 777F). Continuous telemetry confirmed pressurized main-deck compartment stability throughout the transatlantic crossing.',
        scanCode: 'AIR-770',
        completed: true,
      },
      {
        id: '729-5',
        date: '19 Nov 2026',
        localTime: '05:20 EST',
        utcTime: '10:20 UTC',
        hubCode: 'JFK-T4',
        location: 'JFK International Building 78, Jamaica, NY, US',
        title: 'Aircraft Arrived & Priority Ramp Offload',
        explanation:
          'Flight GC-108 touched down at New York JFK. Priority express container offloaded first from main deck directly to Global Courier bonded customs cage.',
        scanCode: 'ARR-204',
        completed: true,
      },
      {
        id: '729-6',
        date: '19 Nov 2026',
        localTime: '06:55 EST',
        utcTime: '11:55 UTC',
        hubCode: 'JFK-CBP',
        location: 'U.S. Customs & Border Protection Automated Gate, JFK',
        title: 'Import Customs Cleared (Zero Hold)',
        explanation:
          'Pre-filed entry #CBP-AE-884920-NY cleared U.S. Customs on arrival under DDP terms with all duties and processing fees settled in advance.',
        scanCode: 'CLR-880',
        completed: true,
      },
      {
        id: '729-7',
        date: '19 Nov 2026',
        localTime: '08:15 EST',
        utcTime: '13:15 UTC',
        hubCode: 'NYC-MID',
        location: 'Manhattan West Dispatch Station, New York, US',
        title: 'Arrived at Local Final-Mile Dispatch Station',
        explanation:
          'Sorted to Midtown commercial route NY-14. Tamper-evident seal #SEAL-FRA-99412 inspected intact before van loading.',
        scanCode: 'SRT-419',
        completed: true,
      },
      {
        id: '729-8',
        date: '19 Nov 2026',
        localTime: '10:45 EST',
        utcTime: '15:45 UTC',
        hubCode: 'NY-14',
        location: 'Midtown Manhattan Courier Route, New York, US',
        title: 'Out for Doorstep Courier Handoff',
        explanation:
          'In possession of uniformed courier Marcus Vance (Vehicle #GC-NY14). Scheduled for direct desk handoff and photo-verified digital signature.',
        scanCode: 'OFD-601',
        completed: true,
        isCurrent: true,
      },
      {
        id: '729-9',
        date: '19 Nov 2026',
        localTime: 'Expected 14:15 EST',
        utcTime: '19:15 UTC',
        hubCode: 'DEST',
        location: '450 Lexington Ave, Suite 2200, New York, NY',
        title: 'Named Recipient Signature & Final Proof of Delivery',
        explanation:
          'Pending final arrival at recipient legal desk. Signed custody certificate and seal verification photo will post immediately upon handoff.',
        scanCode: 'POD-000',
        completed: false,
      },
    ],
  },
  {
    waybill: 'GLC-884102',
    status: 'In Transit · Customs Pre-Cleared',
    statusExplanation:
      'Your Air Express Priority consignment (8.4 kg) departed London Heathrow aboard overnight freighter GC-402 and is currently airborne over the Eurasian corridor toward Singapore Changi. Singapore electronic import clearance has already been approved ahead of landing so the parcel can move directly from aircraft ramp to morning courier vans.',
    nextAction:
      'Flight GC-402 arrives at Singapore Changi Airfreight Centre at 06:40 SGT, followed by Marina Bay doorstep delivery before 10:30 SGT.',
    currentStageIndex: 2,
    originCity: 'London, United Kingdom',
    originFacility: 'London Heathrow Bonded Hub · Building 554',
    originCode: 'LHR',
    originPosition: { lat: 51.47, lng: -0.4543 },
    currentPosition: { lat: 24.4539, lng: 54.3773 },
    currentLocationLabel: 'Flight GC-402 · Airborne Over Arabian Peninsula',
    currentLocationDetails:
      'Widebody A330-200F cruising at FL390 on scheduled LHR → SIN trunk corridor.',
    activeGroundOrigin: { lat: 1.3644, lng: 103.9915 },
    activeGroundOriginLabel: 'Singapore Changi Airfreight Centre (Arrival Hub)',
    destinationCity: 'Singapore',
    destinationAddress: '10 Marina Boulevard, Tower 2, Singapore 018983',
    destinationCode: 'SIN',
    destinationPosition: { lat: 1.2797, lng: 103.8545 },
    service: 'Air Express Priority',
    incoterms: 'DDP · Duties & GST Pre-Cleared',
    weight: '8.4 kg (18.52 lbs)',
    dimensions: '46 × 36 × 24 cm',
    pieceCount: '2 Shock-Cushioned Cartons',
    flightRef: 'Flight GC-402 · Airbus A330-200F',
    customsEntryRef: 'SG-TN-903418-AP',
    customsStatus: 'Pre-Cleared via Singapore TradeNet Single Window',
    securitySeal: 'SEAL-LHR-71048',
    handlingProtocol: 'Priority Prototype Hardware · Upright Orientation',
    shipper: 'Nordholm Acoustics Ltd (Clerkenwell, London)',
    recipient: 'Attn: APAC Retail Flagship Engineering · Marina Bay',
    dispatchedDate: '18 Nov 2026 · 16:05 GMT',
    estimatedDelivery: 'Tomorrow · By 10:30 SGT',
    history: [
      {
        id: '884-1',
        date: '18 Nov 2026',
        localTime: '16:05 GMT',
        utcTime: '16:05 UTC',
        hubCode: 'LON-CLK',
        location: 'St John Street Studio, Clerkenwell, London, UK',
        title: 'Origin Pickup & Protective Overpack Check',
        explanation:
          'Two acoustic hardware cartons scanned, shock-indicator seals checked, and consolidated under master waybill GLC-884102.',
        scanCode: 'COL-114',
        completed: true,
      },
      {
        id: '884-2',
        date: '18 Nov 2026',
        localTime: '18:10 GMT',
        utcTime: '18:10 UTC',
        hubCode: 'LHR-HUB',
        location: 'London Heathrow Bonded Hub, UK',
        title: 'Export Hub Screening & Weight Verification',
        explanation:
          'Verified gross weight 8.4 kg across two pieces and cleared CAA aviation security screening.',
        scanCode: 'SEC-209',
        completed: true,
      },
      {
        id: '884-3',
        date: '18 Nov 2026',
        localTime: '21:05 GMT',
        utcTime: '21:05 UTC',
        hubCode: 'SIN-TN',
        location: 'UK / SG Electronic TradeNet Pre-Clearance Desk',
        title: 'Export & Destination Import Pre-Cleared',
        explanation:
          'HS code 8518.90 commercial declaration validated with zero tariff discrepancy. Singapore Customs issued pre-arrival green-lane release #SG-TN-903418-AP.',
        scanCode: 'CLR-442',
        completed: true,
      },
      {
        id: '884-4',
        date: '19 Nov 2026',
        localTime: '02:15 GMT',
        utcTime: '02:15 UTC',
        hubCode: 'GC-402',
        location: 'London Heathrow → Singapore Changi',
        title: 'Widebody Freighter Departed',
        explanation:
          'Stowed in forward climate-controlled belly hold of flight GC-402 en route to Singapore.',
        scanCode: 'AIR-402',
        completed: true,
        isCurrent: true,
      },
      {
        id: '884-5',
        date: '20 Nov 2026',
        localTime: 'Scheduled 06:40 SGT',
        utcTime: '22:40 UTC',
        hubCode: 'SIN-CAC',
        location: 'Singapore Changi Airfreight Centre, SG',
        title: 'Destination Hub Intake & Morning Van Dispatch',
        explanation:
          'Pre-cleared shipment scheduled for immediate tarmac transfer to Downtown Core delivery fleet.',
        scanCode: 'SRT-000',
        completed: false,
      },
      {
        id: '884-6',
        date: '20 Nov 2026',
        localTime: 'Expected 10:30 SGT',
        utcTime: '02:30 UTC',
        hubCode: 'DEST',
        location: '10 Marina Boulevard, Singapore',
        title: 'Final-Mile Courier Handoff',
        explanation:
          'Direct engineering desk delivery with two-piece verification and digital signature.',
        scanCode: 'POD-000',
        completed: false,
      },
    ],
  },
  {
    waybill: 'GLC-503918',
    status: 'Delivered & Signed',
    statusExplanation:
      'Your Cold-Chain Biotech parcel (14.5 kg) was delivered in full compliance with +2°C to +8°C temperature tolerances to University Ave Research Wing in Toronto at 09:42 EST. Continuous data-logger telemetry recorded an internal chamber range of +3.8°C to +4.4°C across all 41 hours of international transit.',
    nextAction:
      'Delivery completed. Full chain-of-custody record, final delivery coordinates, and continuous thermal log are archived below.',
    currentStageIndex: 4,
    originCity: 'Zurich, Switzerland',
    originFacility: 'Zurich Airport Pharma Dispatch Vault',
    originCode: 'ZRH',
    originPosition: { lat: 47.4647, lng: 8.5492 },
    currentPosition: { lat: 43.6596, lng: -79.3889 },
    currentLocationLabel: 'Delivered · MaRS Research Wing, 101 College St, Toronto',
    currentLocationDetails:
      'Signed by Dr. M. Patel at Clinical Trial Receiving Desk (+4.3°C verified).',
    activeGroundOrigin: { lat: 43.6777, lng: -79.6248 },
    activeGroundOriginLabel: 'Toronto Pearson Bonded Cold-Storage Hub (YYZ)',
    destinationCity: 'Toronto, Canada',
    destinationAddress: '101 College St, MaRS Research Wing, Toronto, ON M5G 1L7',
    destinationCode: 'YYZ',
    destinationPosition: { lat: 43.6596, lng: -79.3889 },
    service: 'Cold-Chain Biotech (+2°C to +8°C)',
    incoterms: 'DDP · Clinical Import Permit Verified',
    weight: '14.5 kg (31.97 lbs)',
    dimensions: '52 × 42 × 40 cm (Active Thermal Container)',
    pieceCount: '1 Active Thermal Enclosure',
    flightRef: 'Flight GC-218 · Boeing 787-9 Cargo',
    customsEntryRef: 'CBSA-PH-512098-ON',
    customsStatus: 'Cleared · Health Canada & CBSA Priority Medical Lane',
    securitySeal: 'SEAL-ZRH-30815',
    handlingProtocol: 'Active +2°C to +8°C Thermal Hold · Continuous Telemetry',
    shipper: 'Helvetia BioSystems AG (Schlieren, Zurich)',
    recipient: 'Signed by: Dr. M. Patel · Clinical Trial Receiving Desk',
    dispatchedDate: '17 Nov 2026 · 16:00 CET',
    estimatedDelivery: 'Delivered · Today at 09:42 EST',
    history: [
      {
        id: '503-1',
        date: '17 Nov 2026',
        localTime: '16:00 CET',
        utcTime: '15:00 UTC',
        hubCode: 'ZRH-PHM',
        location: 'Zurich Pharma Dispatch Hub, CH',
        title: 'Thermal Conditioning & Vault Intake (+4.1°C)',
        explanation:
          'Active cooling enclosure calibrated to +4.1°C, battery autonomy certified for 96 hours, and clinical reagents sealed under #SEAL-ZRH-30815.',
        scanCode: 'THM-101',
        completed: true,
      },
      {
        id: '503-2',
        date: '17 Nov 2026',
        localTime: '19:45 CET',
        utcTime: '18:45 UTC',
        hubCode: 'ZRH-EXP',
        location: 'Swiss Customs Priority Export Desk, ZRH',
        title: 'Swiss Export & Health Canada Pre-Notice Cleared',
        explanation:
          'Export license and cold-chain biological diagnostic classification accepted without inspection hold.',
        scanCode: 'EXP-240',
        completed: true,
      },
      {
        id: '503-3',
        date: '18 Nov 2026',
        localTime: '08:30 EST',
        utcTime: '13:30 UTC',
        hubCode: 'GC-218',
        location: 'Zurich Airport → Toronto Pearson (YYZ)',
        title: 'Transatlantic Uplift Completed (+4.0°C)',
        explanation:
          'Flight GC-218 arrived at Toronto Pearson. Thermal unit logged stable +4.0°C interior temperature throughout flight.',
        scanCode: 'AIR-218',
        completed: true,
      },
      {
        id: '503-4',
        date: '18 Nov 2026',
        localTime: '11:15 EST',
        utcTime: '16:15 UTC',
        hubCode: 'YYZ-CBSA',
        location: 'Toronto Bonded Cold-Storage Terminal, CA',
        title: 'CBSA Priority Medical Clearance Released',
        explanation:
          'Entry #CBSA-PH-512098-ON cleared Canadian customs in 28 minutes inside temperature-controlled vault.',
        scanCode: 'CLR-703',
        completed: true,
      },
      {
        id: '503-5',
        date: '19 Nov 2026',
        localTime: '08:05 EST',
        utcTime: '13:05 UTC',
        hubCode: 'YYZ-VAN',
        location: 'Toronto Pharma Courier Van #GC-CA09',
        title: 'Departed for Laboratory Delivery (+4.2°C)',
        explanation:
          'Transferred to refrigerated final-mile courier van bound for University Ave research corridor.',
        scanCode: 'OFD-610',
        completed: true,
      },
      {
        id: '503-6',
        date: '19 Nov 2026',
        localTime: '09:42 EST',
        utcTime: '14:42 UTC',
        hubCode: 'DEST',
        location: '101 College St, University Ave Research Wing, Toronto',
        title: 'Delivered & Signed (+4.3°C Verified)',
        explanation:
          'Signed by Dr. M. Patel at Clinical Trial Receiving Desk. Final probe check confirmed +4.3°C with zero thermal excursion events.',
        scanCode: 'POD-999',
        completed: true,
        isCurrent: true,
      },
    ],
  },
];

export function extractWaybillCode(raw: string): string {
  const cleaned = raw.trim().toUpperCase();
  const match = cleaned.match(/GLC[-\s]?\d{5,8}/);
  if (match) {
    return match[0].replace(/\s+/g, '-').replace(/^GLC(\d)/, 'GLC-$1');
  }
  return cleaned;
}

export function findParcelInList(
  parcels: TrackableParcel[],
  rawInput: string
): TrackableParcel | undefined {
  const normalized = extractWaybillCode(rawInput).toLowerCase();
  if (!normalized) return undefined;
  return parcels.find((item) => item.waybill.toLowerCase() === normalized);
}
