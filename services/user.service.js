import { db } from './db.js';

export async function checkIdTelegram(idTelegram) {
  const [rows] = await db.query(
    `
    SELECT 1
    FROM ${process.env.DB_NAME_BOTS}.compte c
    JOIN ${process.env.DB_NAME_API}.membre_list m 
      ON c.smada_id = m.id_utilisateur
    WHERE c.id_telegram = ? AND c.app_id =(SELECT id FROM ${process.env.DB_NAME_BOTS}.apps ap WHERE ap.nom_app='Telegram')
    LIMIT 1
    `,
    [idTelegram]
  );

  return rows.length > 0;
}