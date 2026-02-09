import { db } from './db.js';

export async function checkIdTelegram(idTelegram) {
  const [rows] = await db.query(
    `
    SELECT 1
     FROM ${process.env.DB_NAME_BOTS}.comptes c
    JOIN ${process.env.DB_NAME_API}.liste_membres m 
      ON c.smada_id = m.id_utilisateur
    WHERE c.identifiant = ? 
    AND c.allow_create_user =1
    AND c.app_id =(SELECT id FROM ${process.env.DB_NAME_BOTS}.apps ap WHERE ap.nom_app='Telegram')
    LIMIT 1
    `,
    [idTelegram]
  );

  return rows.length > 0;
}