export function returnServiceObject({
  success = false,
  data = null,
  message = "",
  error = null
}) {
  return {
    success,
    data,
    message,
    error
  };
}

/**
 * Convierte un string o Date a formato MySQL DATETIME a medianoche.
 * @param {string | Date} dateInput - Fecha en formato "YYYY-MM-DD" o Date
 * @returns {string} Fecha en formato "YYYY-MM-DD HH:MM:SS"
 */
export function toMySQLDateTime(dateInput) {
  let date;

  if (dateInput instanceof Date) {
    date = dateInput;
  } else if (typeof dateInput === "string") {
    date = new Date(dateInput + "T00:00:00");
  } else {
    throw new Error("Invalid date input");
  }

  const pad = (n) => (n < 10 ? "0" + n : n);

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )} 00:00:00`;
}

export function validateEmail(email = "") {
  if (!email) return { valid: false };

  const normalized = email.trim().toLowerCase();
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  return { valid: regex.test(normalized), normalized };
}
export function formatNamesToTitleCase({
  name = "",
  middleName = "",
  lastName = "",
  secondLastName = ""
}) {
  const toTitleCase = (str) =>
    str
      .toLowerCase()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

  return {
    name: toTitleCase(name),
    middleName: toTitleCase(middleName),
    lastName: toTitleCase(lastName),
    secondLastName: toTitleCase(secondLastName)
  };
}
