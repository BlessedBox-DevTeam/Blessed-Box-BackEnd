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
