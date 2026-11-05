import { detectProhibitedColumns, sanitizeString } from './security.js';

const SCHEMAS = {
  leads: {
    required: ['contact_name', 'location_code'],
    aliases: {
      external_id: ['external_id', 'lead_id', 'id', 'inquiry_id'],
      contact_name: ['contact_name', 'name', 'full_name', 'client_name', 'lead_name'],
      email: ['email', 'email_address'],
      phone: ['phone', 'phone_number', 'mobile'],
      location_code: ['location_code', 'location', 'studio', 'clinic', 'site_code'],
      channel: ['channel', 'source', 'lead_source', 'utm_source'],
      created_at: ['created_at', 'inquiry_date', 'submitted_at', 'date'],
      first_response_minutes: ['first_response_minutes', 'response_minutes', 'response_time_min'],
      followup_touches: ['followup_touches', 'touches', 'attempts', 'follow_ups'],
      stage: ['stage', 'status', 'funnel_stage'],
      estimated_value: ['estimated_value', 'est_value', 'expected_value', 'package_interest_value'],
      marketing_consent: ['marketing_consent', 'consent', 'sms_opt_in', 'opt_in'],
      opted_out: ['opted_out', 'unsubscribed', 'opt_out', 'dnc']
    }
  },
  customers: {
    required: ['customer_name', 'location_code'],
    aliases: {
      external_id: ['external_id', 'customer_id', 'client_id', 'id'],
      customer_name: ['customer_name', 'name', 'client_name', 'full_name'],
      email: ['email', 'email_address'],
      phone: ['phone', 'phone_number', 'mobile'],
      location_code: ['location_code', 'location', 'home_studio', 'clinic'],
      visit_count: ['visit_count', 'visits', 'total_visits'],
      last_visit_date: ['last_visit_date', 'last_visit', 'last_seen'],
      lifetime_spend: ['lifetime_spend', 'total_spend', 'ltv', 'revenue'],
      is_member: ['is_member', 'member', 'active_member', 'membership_active'],
      marketing_consent: ['marketing_consent', 'consent', 'opt_in'],
      opted_out: ['opted_out', 'opt_out', 'unsubscribed']
    }
  },
  memberships: {
    required: ['location_code', 'plan_name'],
    aliases: {
      location_code: ['location_code', 'location', 'studio', 'clinic'],
      plan_name: ['plan_name', 'tier_name', 'membership_name', 'plan'],
      monthly_price: ['monthly_price', 'price', 'monthly_fee', 'dues'],
      active_members: ['active_members', 'members', 'enrolled_count'],
      new_enrollments_30d: ['new_enrollments_30d', 'new_members', 'enrollments_30d'],
      cancellations_30d: ['cancellations_30d', 'cancelled_30d', 'churned_30d'],
      eligible_non_members: ['eligible_non_members', 'eligible_guests', 'upsell_pool']
    }
  }
};

export function parseCsvText(csvText = '') {
  const rows = [];
  let current = '';
  let row = [];
  let inQuotes = false;
  const text = String(csvText).replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(current.trim());
      current = '';
    } else if (ch === '\n') {
      row.push(current.trim());
      if (row.some((cell) => cell !== '')) rows.push(row);
      row = [];
      current = '';
    } else {
      current += ch;
    }
  }
  row.push(current.trim());
  if (row.some((cell) => cell !== '')) rows.push(row);
  return rows;
}

export function autoMapColumns(entityType, headers = []) {
  const schema = SCHEMAS[entityType];
  if (!schema) throw new Error(`Unsupported import entity type: ${entityType}`);
  const mapping = {};
  const normalizedHeaders = headers.map((h) =>
    h.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  );

  for (const [canonicalField, aliasList] of Object.entries(schema.aliases)) {
    const idx = normalizedHeaders.findIndex((nh) => aliasList.includes(nh));
    if (idx !== -1) {
      mapping[canonicalField] = headers[idx];
    }
  }
  return mapping;
}

function parseBool(val, defaultVal = false) {
  if (val === undefined || val === null || val === '') return defaultVal;
  const s = String(val).trim().toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(s)) return true;
  if (['false', '0', 'no', 'n'].includes(s)) return false;
  return defaultVal;
}

export function validateAndPreviewCsv({
  entityType,
  csvText,
  customMapping = null,
  orgLocations = [],
  existingRecords = []
}) {
  if (!SCHEMAS[entityType]) {
    return {
      ok: false,
      error: `Invalid entityType "${entityType}". Expected leads, customers, or memberships.`
    };
  }

  const matrix = parseCsvText(csvText);
  if (matrix.length < 2) {
    return {
      ok: false,
      error: 'CSV must contain a header row and at least one data row.'
    };
  }

  const headers = matrix[0];
  const prohibited = detectProhibitedColumns(headers);
  if (prohibited.length > 0) {
    return {
      ok: false,
      complianceBlocked: true,
      prohibitedColumns: prohibited,
      error: `Import blocked by Non-Clinical Compliance Policy. Prohibited clinical/PHI columns detected: ${prohibited.join(', ')}. Strip clinical notes, diagnoses, prescriptions, and SSNs before importing.`
    };
  }

  const autoMapping = autoMapColumns(entityType, headers);
  const mapping = { ...autoMapping, ...(customMapping || {}) };
  const missingRequired = SCHEMAS[entityType].required.filter((reqField) => !mapping[reqField]);

  if (missingRequired.length > 0) {
    return {
      ok: false,
      headers,
      detectedMapping: mapping,
      missingRequired,
      error: `Missing required mapped columns for ${entityType}: ${missingRequired.join(', ')}`
    };
  }

  const headerIndex = Object.fromEntries(headers.map((h, idx) => [h, idx]));
  const locByLookup = new Map();
  for (const loc of orgLocations) {
    locByLookup.set(loc.code.toLowerCase(), loc);
    locByLookup.set(loc.name.toLowerCase(), loc);
    locByLookup.set(loc.id.toLowerCase(), loc);
  }

  const existingKeys = new Set();
  for (const rec of existingRecords) {
    if (rec.external_id) existingKeys.add(`ext:${String(rec.external_id).toLowerCase()}`);
    if (rec.email) existingKeys.add(`email:${String(rec.email).toLowerCase()}`);
    if (entityType === 'memberships' && rec.location_id && rec.plan_name) {
      existingKeys.add(`plan:${rec.location_id}:${rec.plan_name.toLowerCase()}`);
    }
  }

  const seenInFile = new Set();
  const validRecords = [];
  const duplicateRows = [];
  const invalidRows = [];

  for (let r = 1; r < matrix.length; r++) {
    const rawRow = matrix[r];
    const lineNum = r + 1;
    const getVal = (field) => {
      const colName = mapping[field];
      if (!colName || headerIndex[colName] === undefined) return '';
      return rawRow[headerIndex[colName]] ?? '';
    };

    const locInput = sanitizeString(getVal('location_code'), 80);
    const matchedLoc = locByLookup.get(locInput.toLowerCase()) || orgLocations[0] || null;
    if (!locInput || !locByLookup.has(locInput.toLowerCase())) {
      invalidRows.push({
        line: lineNum,
        reason: `Unknown or missing location "${locInput}". Must match an organization location code or name.`
      });
      continue;
    }

    if (entityType === 'leads') {
      const name = sanitizeString(getVal('contact_name'), 120);
      const email = sanitizeString(getVal('email'), 120).toLowerCase();
      const phone = sanitizeString(getVal('phone'), 40);
      const extId = sanitizeString(getVal('external_id'), 80);
      if (!name) {
        invalidRows.push({ line: lineNum, reason: 'Missing contact_name' });
        continue;
      }
      if (!email && !phone && !extId) {
        invalidRows.push({
          line: lineNum,
          reason: 'Lead row must include at least email, phone, or external_id for deduplication'
        });
        continue;
      }

      const dedupKey = extId
        ? `ext:${extId.toLowerCase()}`
        : email
        ? `email:${email}`
        : `phone:${phone}`;

      if (existingKeys.has(dedupKey) || seenInFile.has(dedupKey)) {
        duplicateRows.push({
          line: lineNum,
          identifier: email || extId || phone,
          reason: existingKeys.has(dedupKey) ? 'Already exists in tenant database' : 'Duplicate within CSV file'
        });
        continue;
      }
      seenInFile.add(dedupKey);

      const rawResp = getVal('first_response_minutes');
      const respMin = rawResp === '' ? null : Number(rawResp);
      if (respMin !== null && (Number.isNaN(respMin) || respMin < 0)) {
        invalidRows.push({ line: lineNum, reason: 'Invalid negative or non-numeric first_response_minutes' });
        continue;
      }

      const allowedStages = [
        'new',
        'contacted',
        'consultation_booked',
        'consultation_attended',
        'converted',
        'lost'
      ];
      const rawStage = sanitizeString(getVal('stage') || 'new', 40).toLowerCase();
      const stage = allowedStages.includes(rawStage) ? rawStage : 'new';

      validRecords.push({
        external_id: extId || `csv-lead-${Date.now()}-${r}`,
        location_id: matchedLoc.id,
        contact_name: name,
        email,
        phone,
        channel: sanitizeString(getVal('channel') || 'CSV Upload', 60),
        created_at: getVal('created_at')
          ? new Date(getVal('created_at')).toISOString()
          : new Date().toISOString(),
        first_response_minutes: respMin,
        followup_touches: Math.max(0, Number(getVal('followup_touches')) || 0),
        stage,
        estimated_value: Math.max(0, Number(getVal('estimated_value')) || 650),
        marketing_consent: parseBool(getVal('marketing_consent'), true),
        opted_out: parseBool(getVal('opted_out'), false),
        is_synthetic: false,
        data_source: 'csv_import'
      });
    } else if (entityType === 'customers') {
      const name = sanitizeString(getVal('customer_name'), 120);
      const email = sanitizeString(getVal('email'), 120).toLowerCase();
      const extId = sanitizeString(getVal('external_id'), 80);
      if (!name) {
        invalidRows.push({ line: lineNum, reason: 'Missing customer_name' });
        continue;
      }
      const dedupKey = extId ? `ext:${extId.toLowerCase()}` : `email:${email || name.toLowerCase()}`;
      if (existingKeys.has(dedupKey) || seenInFile.has(dedupKey)) {
        duplicateRows.push({
          line: lineNum,
          identifier: email || extId || name,
          reason: existingKeys.has(dedupKey) ? 'Already exists in tenant database' : 'Duplicate within CSV file'
        });
        continue;
      }
      seenInFile.add(dedupKey);

      const lastVisitRaw = getVal('last_visit_date');
      const parsedLast = lastVisitRaw ? new Date(lastVisitRaw) : new Date(Date.now() - 130 * 86400000);
      if (Number.isNaN(parsedLast.getTime())) {
        invalidRows.push({ line: lineNum, reason: `Invalid last_visit_date "${lastVisitRaw}"` });
        continue;
      }

      validRecords.push({
        external_id: extId || `csv-cust-${Date.now()}-${r}`,
        location_id: matchedLoc.id,
        customer_name: name,
        email,
        phone: sanitizeString(getVal('phone'), 40),
        visit_count: Math.max(1, Number(getVal('visit_count')) || 1),
        last_visit_date: parsedLast.toISOString().slice(0, 10),
        lifetime_spend: Math.max(0, Number(getVal('lifetime_spend')) || 450),
        is_member: parseBool(getVal('is_member'), false),
        marketing_consent: parseBool(getVal('marketing_consent'), true),
        opted_out: parseBool(getVal('opted_out'), false),
        is_synthetic: false,
        data_source: 'csv_import'
      });
    } else if (entityType === 'memberships') {
      const planName = sanitizeString(getVal('plan_name'), 100);
      if (!planName) {
        invalidRows.push({ line: lineNum, reason: 'Missing plan_name' });
        continue;
      }
      const dedupKey = `plan:${matchedLoc.id}:${planName.toLowerCase()}`;
      if (existingKeys.has(dedupKey) || seenInFile.has(dedupKey)) {
        duplicateRows.push({
          line: lineNum,
          identifier: `${matchedLoc.code} · ${planName}`,
          reason: 'Duplicate location membership plan'
        });
        continue;
      }
      seenInFile.add(dedupKey);

      validRecords.push({
        location_id: matchedLoc.id,
        plan_name: planName,
        monthly_price: Math.max(49, Number(getVal('monthly_price')) || 199),
        active_members: Math.max(0, Number(getVal('active_members')) || 0),
        new_enrollments_30d: Math.max(0, Number(getVal('new_enrollments_30d')) || 0),
        cancellations_30d: Math.max(0, Number(getVal('cancellations_30d')) || 0),
        eligible_non_members: Math.max(0, Number(getVal('eligible_non_members')) || 0),
        is_synthetic: false,
        data_source: 'csv_import'
      });
    }
  }

  return {
    ok: true,
    entityType,
    headers,
    detectedMapping: mapping,
    summary: {
      totalRows: matrix.length - 1,
      validCount: validRecords.length,
      duplicateCount: duplicateRows.length,
      invalidCount: invalidRows.length
    },
    duplicateRows,
    invalidRows,
    previewRecords: validRecords.slice(0, 25),
    allValidRecords: validRecords
  };
}
