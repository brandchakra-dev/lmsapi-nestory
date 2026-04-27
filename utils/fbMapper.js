/**
 * Normalize phone: strip everything except digits, keep last 10 digits for Indian numbers
 * "+91-98765 43210" → "9876543210"
 */
const normalizePhone = (raw) => {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");           // strip non-digits
  // If Indian number with country code (91xxxxxxxxxx = 12 digits), strip the 91
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits.slice(2);
  }
  // If 10 digits already, return as is
  if (digits.length === 10) return digits;
  // Otherwise return cleaned digits (international or unknown format)
  return digits;
};

/**
 * Normalize name: trim + title case
 * "  rahul sharma " → "Rahul Sharma"
 */
const normalizeName = (raw) => {
  if (!raw) return "";
  return raw
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

/**
 * Known Facebook field name variants → our internal key
 */
const FIELD_MAP = {
  // Name
  full_name:      "name",
  name:           "name",
  first_name:     "firstName",
  last_name:      "lastName",

  // Phone
  phone_number:   "phone",
  phone:          "phone",
  mobile_number:  "phone",
  contact_number: "phone",

  // Email
  email:          "email",
  email_address:  "email",
};

exports.mapFacebookLead = (fbData) => {
  const mapped = {
    name:    "",
    phone:   "",
    email:   "",
    details: {},   // object instead of string — easier to query/display
  };

  if (!fbData?.field_data || !Array.isArray(fbData.field_data)) {
    console.warn("mapFacebookLead: field_data missing or invalid", fbData);
    return mapped;
  }

  let firstName = "";
  let lastName  = "";

  fbData.field_data.forEach((field) => {
    const key   = field.name?.toLowerCase().trim();
    const value = field.values?.[0]?.trim() ?? "";

    const internalKey = FIELD_MAP[key];

    switch (internalKey) {
      case "name":
        mapped.name = normalizeName(value);
        break;

      case "firstName":
        firstName = normalizeName(value);
        break;

      case "lastName":
        lastName = normalizeName(value);
        break;

      case "phone":
        mapped.phone = normalizePhone(value);
        break;

      case "email":
        mapped.email = value.toLowerCase().trim();
        break;

      default:
        // Store unknown fields as key-value in details object
        if (key && value) {
          mapped.details[key] = value;
        }
    }
  });

  // Combine first + last if full name wasn't provided
  if (!mapped.name && (firstName || lastName)) {
    mapped.name = `${firstName} ${lastName}`.trim();
  }

  return mapped;
};