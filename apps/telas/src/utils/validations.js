export function validateInspection(info) {

  const errors = [];

  if (!info.date) {
    errors.push("La fecha es obligatoria.");
  }

  if (!info.supplier.trim()) {
    errors.push("El proveedor es obligatorio.");
  }

  if (!info.fabric.trim()) {
    errors.push("El nombre de la tela es obligatorio.");
  }

  if (!info.remision.trim()) {
    errors.push("La remisión es obligatoria.");
  }

  if (
    info.email.trim() &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(info.email.trim())
  ) {
    errors.push("El correo del destinatario no tiene un formato válido.");
  }

  return errors;
}
