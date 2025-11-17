function returnServiceObject({
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
 * Convierte un string o Date a formato MySQL UTC a medianoche.
 * @param {string | Date} dateInput - Fecha en formato "YYYY-MM-DD" o Date
 * @returns {string} Fecha en formato UTC
 */
function toMySQLDateTimeUTC(dateInput) {
  let date;

  if (dateInput instanceof Date) {
    date = dateInput;
  } else if (typeof dateInput === "string") {
    date = new Date(dateInput);
  } else {
    throw new Error("Invalid date input");
  }

  const pad = (n) => (n < 10 ? "0" + n : n);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
    date.getUTCDate()
  )} 00:00:00`;
}

function validateEmail(email = "") {
  if (!email) return { valid: false };

  const normalized = email.trim().toLowerCase();
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  return { valid: regex.test(normalized), normalized };
}
function formatNamesToTitleCase({
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

module.exports = {
  formatNamesToTitleCase,
  validateEmail,
  toMySQLDateTimeUTC,
  returnServiceObject
};
