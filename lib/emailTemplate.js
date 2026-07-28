// Plantilla HTML compartida para los correos del sistema (cambio de etapa,
// proyecto nuevo, recuperar contraseña). Usa estilos en línea a propósito:
// la mayoría de clientes de correo ignora <style> en el <head> y CSS
// externo, así que las reglas tienen que ir directo en cada elemento.
function buildEmailHtml({ heading, bodyHtml }) {
  return `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 480px; margin: 0 auto; background-color: #ffffff;">
      <div style="background-color: #035496; padding: 18px 24px; border-radius: 10px 10px 0 0;">
        <span style="color: #ffffff; font-size: 18px; font-weight: bold; letter-spacing: 0.5px;">
          Ipsum
        </span>
      </div>

      <div style="border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px; padding: 24px;">
        <h2 style="margin: 0 0 14px; color: #035496; font-size: 18px;">
          ${heading}
        </h2>

        <div style="color: #1e293b; font-size: 14px; line-height: 1.6;">
          ${bodyHtml}
        </div>
      </div>

      <p style="color: #94a3b8; font-size: 11px; text-align: center; margin-top: 16px;">
        Correo automático del sistema Ipsum. No responda a este mensaje.
      </p>
    </div>
  `;
}

// Bloque destacado (fondo gris claro, texto centrado) para resaltar un
// dato puntual dentro del correo: la etapa nueva, el nombre del proyecto,
// la contraseña temporal, etc.
function highlightBox(label, value) {
  return `
    <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      <tr>
        <td style="padding: 12px 16px; background-color: #f1f5f9; border-radius: 8px; text-align: center;">
          <span style="display: block; font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">
            ${label}
          </span>
          <span style="display: block; font-size: 18px; font-weight: bold; color: #035496; margin-top: 4px;">
            ${value}
          </span>
        </td>
      </tr>
    </table>
  `;
}

module.exports = { buildEmailHtml, highlightBox };
