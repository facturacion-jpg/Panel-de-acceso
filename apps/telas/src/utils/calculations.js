export function calculateRoll(roll, limit = 40) {

  const length = Number(roll.length);
  const width = Number(roll.width);

  const counts = [
    roll.d1,
    roll.d2,
    roll.d3,
    roll.d4
  ].map((value) =>
    value === "" ? 0 : Number(value)
  );

  const hasMeasurements =
    roll.length !== "" &&
    roll.width !== "" &&
    length > 0 &&
    width > 0;

  const totalPoints =
    counts[0] +
    2 * counts[1] +
    3 * counts[2] +
    4 * counts[3];

  if (!hasMeasurements) {
    return {
      totalPoints,
      pointsPer100: null,
      decision: "Pendiente"
    };
  }

  const pointsPer100 =
    totalPoints * 3600 /
    (
      (length / 0.9144) *
      (width / 2.54)
    );

  return {
    totalPoints,
    pointsPer100,

    decision:
      pointsPer100 <= limit
        ? "Aceptado"
        : "Rechazado / segunda"
  };
}

export function calculateLot(rolls, limit = 28) {

  const inspected = rolls.filter(
    (roll) => roll.pointsPer100 !== null
  );

  const accepted = inspected.filter(
    (roll) => roll.decision === "Aceptado"
  ).length;

  const rejected = inspected.filter(
    (roll) => roll.decision === "Rechazado / segunda"
  ).length;

  const totalPoints = inspected.reduce(
    (sum, roll) => sum + (roll.totalPoints || 0),
    0
  );

  const totalAreaFactor = inspected.reduce(
    (sum, roll) =>
      sum +
      (
        (Number(roll.length) / 0.9144) *
        (Number(roll.width) / 2.54)
      ),
    0
  );

  const average = totalAreaFactor > 0
    ? totalPoints * 3600 / totalAreaFactor
    : null;

  const rejectRate = inspected.length
    ? rejected / inspected.length
    : 0;

  const decision = !inspected.length
    ? "Pendiente"
    : (
        average <= limit && rejectRate <= 0.15
          ? "Lote aceptado"
          : "Lote rechazado"
      );

  return {
    inspected: inspected.length,
    accepted,
    rejected,
    average,
    rejectRate,
    decision
  };
}
