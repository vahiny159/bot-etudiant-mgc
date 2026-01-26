import { db } from './db.js';

export async function checkIdTelegram(idTelegram) {
  const [rows] = await db.query(
    `
    SELECT 1
    FROM bots.compte c
    JOIN mada_api.membre_list m 
      ON c.id_smada = m.id_utilisateur
    WHERE c.id_telegram = ?
    LIMIT 1
    `,
    [idTelegram]
  );

  return rows.length > 0;
}