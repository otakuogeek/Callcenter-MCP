import * as fs from 'fs';
import * as path from 'path';
import * as mysql from 'mysql2/promise';

// Configuración directa de la base de datos
const DB_CONFIG = {
  host: '127.0.0.1',
  port: 3306,
  user: 'biosanar_user',
  password: '/6Tx0eXqFQONTFuoc7aqPicNlPhmuINU',
  database: 'biosanar'
};

interface CupsRecord {
  code: string;
  name: string;
  amount: number;
}

async function importCupsFromCSV() {
  let connection: mysql.Connection | null = null;

  try {
    console.log('� Iniciando importación de códigos CUPS...\n');

    // Conectar a la base de datos
    console.log('🔌 Conectando a la base de datos...');
    connection = await mysql.createConnection(DB_CONFIG);
    console.log('✅ Conectado exitosamente\n');

    // Leer el archivo CSV
    const csvPath = path.join(__dirname, '../../Libro3.csv');
    console.log(`📄 Leyendo archivo CSV: ${csvPath}`);
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());

    // Procesar líneas (saltar header)
    const recordsMap = new Map<string, CupsRecord>();

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Parsear CSV (formato: codigo cups,nombrecups,Monto)
      const parts = line.split(',');
      if (parts.length < 3) continue;

      const code = parts[0].trim();
      const name = parts.slice(1, -1).join(',').trim(); // El nombre puede tener comas
      const amountStr = parts[parts.length - 1].trim();
      const amount = parseFloat(amountStr) || 0;

      if (!code) continue;

      // Si ya existe el código, mantener el monto más alto
      if (recordsMap.has(code)) {
        const existing = recordsMap.get(code)!;
        if (amount > existing.amount) {
          existing.amount = amount;
        }
      } else {
        recordsMap.set(code, { code, name, amount });
      }
    }

    // Convertir el mapa a array
    const uniqueRecords = Array.from(recordsMap.values());
    console.log(`📊 Registros únicos encontrados: ${uniqueRecords.length}\n`);

    // Insertar o actualizar registros
    let inserted = 0;
    let updated = 0;
    let errors = 0;

    console.log('💾 Insertando/actualizando registros en la base de datos...\n');

    for (const record of uniqueRecords) {
      try {
        // Intentar insertar, si existe actualizar
        const query = `
          INSERT INTO cups (code, name, price, status, category)
          VALUES (?, ?, ?, 'Activo', 'Ecografía')
          ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            price = VALUES(price),
            updated_at = CURRENT_TIMESTAMP
        `;

        const [result]: any = await connection.execute(query, [
          record.code,
          record.name,
          record.amount
        ]);

        if (result.affectedRows === 1) {
          inserted++;
          console.log(`✅ Insertado: ${record.code} - ${record.name.substring(0, 50)}...`);
        } else if (result.affectedRows === 2) {
          updated++;
          console.log(`� Actualizado: ${record.code} - ${record.name.substring(0, 50)}...`);
        }

      } catch (error: any) {
        errors++;
        console.error(`❌ Error con código ${record.code}:`, error.message);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('� RESUMEN DE IMPORTACIÓN:');
    console.log('='.repeat(60));
    console.log(`✅ Registros insertados: ${inserted}`);
    console.log(`🔄 Registros actualizados: ${updated}`);
    console.log(`❌ Errores: ${errors}`);
    console.log(`� Total procesado: ${uniqueRecords.length}`);
    console.log('='.repeat(60) + '\n');

    // Verificar los datos insertados
    const [rows]: any = await connection.query(
      'SELECT COUNT(*) as total, SUM(price) as total_price FROM cups WHERE status = "Activo"'
    );
    console.log(`🎯 Total de códigos CUPS activos en la base de datos: ${rows[0].total}`);
    const totalPrice = rows[0].total_price ? parseFloat(rows[0].total_price) : 0;
    console.log(`💰 Valor total de procedimientos: $${totalPrice.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`);

  } catch (error) {
    console.error('\n❌ Error durante la importación:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Conexión cerrada');
    }
  }
}

// Ejecutar la importación
importCupsFromCSV()
  .then(() => {
    console.log('\n✅ Importación completada exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error fatal:', error);
    process.exit(1);
  });// Ejecutar
importCupsFromCSV();
