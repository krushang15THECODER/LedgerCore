export function required(value, field) {
  if (value === undefined || value === null || value === "") {
    const err = new Error(`${field} is required.`);
    err.status = 400;
    throw err;
  }
}

export function positivePaise(value, field = "amount") {
  required(value, field);

  const amount = Number(value);

  if (!Number.isSafeInteger(amount) || amount <= 0) {
    const err = new Error(`${field} must be a positive integer number of paise.`);
    err.status = 400;
    throw err;
  }

  return amount;
}

export function id(value, field = "id") {
  required(value, field);

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    const err = new Error(`${field} must be a positive integer.`);
    err.status = 400;
    throw err;
  }

  return parsed;
}
