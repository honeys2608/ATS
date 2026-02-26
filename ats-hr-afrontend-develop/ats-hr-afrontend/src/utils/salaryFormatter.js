/**
 * Salary Formatter - Convert numbers to Indian format (Thousands, Lakhs, Crores)
 * Following market standards like Naukri, LinkedIn India, Indeed
 */

export const formatSalaryDisplay = (amount) => {
  if (!amount || amount === 0) return "Not specified";

  const num = parseInt(amount);

  if (num >= 10000000) {
    // Crores (1 Crore = 10 Million)
    return (num / 10000000).toFixed(1).replace(/\.0+$/, "") + " Cr";
  } else if (num >= 100000) {
    // Lakhs (1 Lakh = 100,000)
    return (num / 100000).toFixed(1).replace(/\.0+$/, "") + " L";
  } else if (num >= 1000) {
    // Thousands
    return (num / 1000).toFixed(1).replace(/\.0+$/, "") + "K";
  }

  return num.toString();
};

export const formatSalaryForInput = (value) => {
  if (!value || value === "") return "";

  // Remove all non-numeric characters
  let num = value.replace(/[^\d.]/g, "");

  // If it contains 'Cr' or Crores, multiply by 10 million
  if (value.toLowerCase().includes("cr")) {
    num = parseFloat(num) * 10000000;
  }
  // If it contains 'L' or 'Lakh', multiply by 100000
  else if (value.toLowerCase().includes("l")) {
    num = parseFloat(num) * 100000;
  }
  // If it contains 'K', multiply by 1000
  else if (value.toLowerCase().includes("k")) {
    num = parseFloat(num) * 1000;
  }

  return Math.floor(num).toString();
};

export const parseSalaryInput = (input) => {
  if (!input) return "";

  const cleaned = input.trim().toUpperCase();

  // Handle Crores
  if (cleaned.includes("CR")) {
    const num = parseFloat(cleaned.replace(/[^0-9.]/g, ""));
    return (num * 10000000).toString();
  }

  // Handle Lakhs
  if (cleaned.includes("L")) {
    const num = parseFloat(cleaned.replace(/[^0-9.]/g, ""));
    return (num * 100000).toString();
  }

  // Handle Thousands
  if (cleaned.includes("K")) {
    const num = parseFloat(cleaned.replace(/[^0-9.]/g, ""));
    return (num * 1000).toString();
  }

  // Plain number
  return cleaned.replace(/[^0-9]/g, "");
};
