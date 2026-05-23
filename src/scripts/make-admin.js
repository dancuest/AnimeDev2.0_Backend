const { Pool } = require('pg');

const targetEmail = process.argv[2];

if (!targetEmail) {
  console.error('Debes enviar el email del usuario.');
  console.error('Ejemplo: node scripts/make-admin.js dancuest093@gmail.com');
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL no está configurada en esta terminal.');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function main() {
  const client = await pool.connect();

  try {
    const before = await client.query(
      `
      SELECT id, email, "deviceId", role, "createdAt"
      FROM "User"
      WHERE email = $1
      `,
      [targetEmail],
    );

    if (before.rowCount === 0) {
      console.log(`No se encontró ningún usuario con email: ${targetEmail}`);
      console.log('Usuarios recientes:');

      const users = await client.query(
        `
        SELECT id, email, "deviceId", role, "createdAt"
        FROM "User"
        ORDER BY "createdAt" DESC
        LIMIT 10
        `,
      );

      console.table(users.rows);
      return;
    }

    console.log('Usuario antes del cambio:');
    console.table(before.rows);

    await client.query(
      `
      UPDATE "User"
      SET role = 'ADMIN'
      WHERE email = $1
      `,
      [targetEmail],
    );

    const after = await client.query(
      `
      SELECT id, email, "deviceId", role, "createdAt"
      FROM "User"
      WHERE email = $1
      `,
      [targetEmail],
    );

    console.log('Usuario después del cambio:');
    console.table(after.rows);

    console.log('Listo. El usuario ahora debe tener rol ADMIN.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Error al actualizar el usuario:');
  console.error(error);
  process.exit(1);
});