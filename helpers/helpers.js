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
