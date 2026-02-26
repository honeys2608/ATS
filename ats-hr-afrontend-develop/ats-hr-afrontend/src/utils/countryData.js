// src/utils/countryData.js
// International country codes and phone formats

export const COUNTRY_CODES = [
  {
    code: "+1",
    country: "USA/Canada",
    digits: 10,
    format: "+1 (XXX) XXX-XXXX",
  },
  {
    code: "+44",
    country: "United Kingdom",
    digits: 10,
    format: "+44 XXXX XXXXXX",
  },
  { code: "+91", country: "India", digits: 10, format: "+91 XXXXX XXXXX" },
  { code: "+86", country: "China", digits: 11, format: "+86 XXXXXXXXXXX" },
  { code: "+81", country: "Japan", digits: 10, format: "+81 XX XXXX XXXX" },
  { code: "+61", country: "Australia", digits: 9, format: "+61 X XXXX XXXX" },
  { code: "+33", country: "France", digits: 9, format: "+33 X XX XX XX XX" },
  { code: "+49", country: "Germany", digits: 11, format: "+49 XXX XXXXXXXX" },
  { code: "+39", country: "Italy", digits: 10, format: "+39 XXX XXXXXXX" },
  { code: "+34", country: "Spain", digits: 9, format: "+34 XXX XX XX XX" },
  { code: "+31", country: "Netherlands", digits: 9, format: "+31 X XXXX XXXX" },
  { code: "+46", country: "Sweden", digits: 9, format: "+46 X XXXX XXXX" },
  { code: "+47", country: "Norway", digits: 8, format: "+47 XXXX XXXX" },
  {
    code: "+41",
    country: "Switzerland",
    digits: 9,
    format: "+41 XX XXX XX XX",
  },
  { code: "+43", country: "Austria", digits: 10, format: "+43 X XXXX XXXX" },
  { code: "+32", country: "Belgium", digits: 9, format: "+32 X XXX XX XX" },
  { code: "+45", country: "Denmark", digits: 8, format: "+45 XXXX XXXX" },
  { code: "+358", country: "Finland", digits: 9, format: "+358 X XXXX XXXX" },
  { code: "+353", country: "Ireland", digits: 9, format: "+353 X XXXX XXXX" },
  { code: "+48", country: "Poland", digits: 9, format: "+48 XX XXX XX XX" },
  { code: "+40", country: "Romania", digits: 9, format: "+40 XXX XXX XXX" },
  { code: "+30", country: "Greece", digits: 10, format: "+30 XXX XXXXXXX" },
  { code: "+90", country: "Turkey", digits: 10, format: "+90 XXX XXXXXXX" },
  { code: "+55", country: "Brazil", digits: 11, format: "+55 XX XXXXX XXXX" },
  { code: "+54", country: "Argentina", digits: 10, format: "+54 XX XXXX XXXX" },
  { code: "+52", country: "Mexico", digits: 10, format: "+52 XXX XXXXXXX" },
  { code: "+56", country: "Chile", digits: 9, format: "+56 X XXXX XXXX" },
  { code: "+57", country: "Colombia", digits: 10, format: "+57 X XXXX XXXX" },
  { code: "+64", country: "New Zealand", digits: 9, format: "+64 X XXXX XXXX" },
  { code: "+65", country: "Singapore", digits: 8, format: "+65 XXXX XXXX" },
  { code: "+60", country: "Malaysia", digits: 10, format: "+60 XX XXXX XXXX" },
  { code: "+66", country: "Thailand", digits: 9, format: "+66 X XXXX XXXX" },
  {
    code: "+62",
    country: "Indonesia",
    digits: 10,
    format: "+62 XXX XXXXX XXXX",
  },
  {
    code: "+63",
    country: "Philippines",
    digits: 10,
    format: "+63 XXX XXX XXXX",
  },
  {
    code: "+82",
    country: "South Korea",
    digits: 10,
    format: "+82 XX XXXX XXXX",
  },
  { code: "+84", country: "Vietnam", digits: 9, format: "+84 X XXXX XXXX" },
  {
    code: "+27",
    country: "South Africa",
    digits: 9,
    format: "+27 XX XXX XXXX",
  },
  { code: "+20", country: "Egypt", digits: 10, format: "+20 XXX XXX XXXX" },
  {
    code: "+234",
    country: "Nigeria",
    digits: 10,
    format: "+234 XXX XXXX XXXX",
  },
  { code: "+971", country: "UAE", digits: 9, format: "+971 XXX XXX XXXX" },
  {
    code: "+966",
    country: "Saudi Arabia",
    digits: 9,
    format: "+966 XX XXXX XXXX",
  },
];

export const getCountryByCode = (code) => {
  return COUNTRY_CODES.find((c) => c.code === code);
};

export const getCountryCodes = () => {
  return COUNTRY_CODES.map((c) => ({
    label: `${c.code} ${c.country}`,
    value: c.code,
  }));
};

export const validatePhoneForCountry = (countryCode, phoneDigits) => {
  const country = getCountryByCode(countryCode);
  if (!country) return "Invalid country code";

  const digits = phoneDigits.replace(/\D/g, "");
  if (digits.length !== country.digits) {
    return `${country.country} requires exactly ${country.digits} digits (got ${digits.length})`;
  }

  return null;
};
