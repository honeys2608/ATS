// Popular Indian cities and some international cities
export const POPULAR_CITIES = [
  // Metro Cities
  { value: "bangalore", label: "Bangalore" },
  { value: "hyderabad", label: "Hyderabad" },
  { value: "mumbai", label: "Mumbai" },
  { value: "delhi", label: "Delhi" },
  { value: "delhi-ncr", label: "Delhi NCR" },
  { value: "gurgaon", label: "Gurgaon" },
  { value: "noida", label: "Noida" },
  { value: "pune", label: "Pune" },
  { value: "kolkata", label: "Kolkata" },
  { value: "chennai", label: "Chennai" },
  { value: "ahmedabad", label: "Ahmedabad" },
  { value: "jaipur", label: "Jaipur" },
  { value: "lucknow", label: "Lucknow" },
  { value: "kochi", label: "Kochi" },
  { value: "chandigarh", label: "Chandigarh" },
  { value: "indore", label: "Indore" },
  { value: "surat", label: "Surat" },
  { value: "nagpur", label: "Nagpur" },
  { value: "vadodara", label: "Vadodara" },
  { value: "visakhapatnam", label: "Visakhapatnam" },
  { value: "coimbatore", label: "Coimbatore" },
  { value: "bhopal", label: "Bhopal" },
  { value: "guwahati", label: "Guwahati" },
  { value: "thane", label: "Thane" },
  { value: "ranchi", label: "Ranchi" },
];

/**
 * Validate city - must be from list or custom string
 */
export const validateCity = (city) => {
  if (!city || !city.trim()) return "City is required";

  const trimmed = city.trim();
  if (trimmed.length < 2) return "City name must be at least 2 characters";
  if (trimmed.length > 100) return "City name is too long";

  if (!/^[a-zA-Z\s&\-().,]+$/.test(trimmed)) {
    return "City name contains invalid characters";
  }

  return null;
};
