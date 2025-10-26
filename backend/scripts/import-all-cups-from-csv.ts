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

async function importAllCupsFromCSV() {
  let connection: mysql.Connection | null = null;

  try {
    console.log('📚 Iniciando importación COMPLETA de códigos CUPS...\n');

    // Conectar a la base de datos
    console.log('🔌 Conectando a la base de datos...');
    connection = await mysql.createConnection(DB_CONFIG);
    console.log('✅ Conectado exitosamente\n');

    // Leer el archivo CSV
    const csvPath = path.join(__dirname, '../../Libro3.csv');
    console.log(`📄 Leyendo archivo CSV: ${csvPath}`);
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());

    console.log(`📊 Total de líneas en CSV: ${lines.length - 1} (excluyendo header)\n`);

    // Procesar TODAS las líneas sin consolidar
    const allRecords: CupsRecord[] = [];

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

      if (!code || !name) continue;

      allRecords.push({ code, name, amount });
    }

    console.log(`📝 Registros a importar: ${allRecords.length}\n`);

    // Insertar TODOS los registros (con duplicados)
    let inserted = 0;
    let skipped = 0;
    let errors = 0;

    console.log('💾 Insertando registros en la base de datos...\n');

    // Determinar categoría basada en el código
    const getCategory = (code: string): string => {
      if (code.startsWith('881')) return 'Ecografía';
      if (code.startsWith('882')) return 'Ecografía Doppler';
      if (code.startsWith('231')) return 'Odontología';
      if (code.startsWith('871')) return 'Procedimientos';
      if (code.startsWith('872')) return 'Diagnóstico';
      if (code.startsWith('876')) return 'Imágenes';
      return 'Otros';
    };

    // Agrupar por código para mostrar mejor información
    const codeGroups = new Map<string, CupsRecord[]>();
    allRecords.forEach(record => {
      if (!codeGroups.has(record.code)) {
        codeGroups.set(record.code, []);
      }
      codeGroups.get(record.code)!.push(record);
    });

    for (const [code, records] of codeGroups) {
      try {
        // Si hay múltiples precios para el mismo código, tomar el más alto
        const maxPrice = Math.max(...records.map(r => r.amount));
        const name = records[0].name; // Usar el primer nombre encontrado

        const category = getCategory(code);

        // Insertar el registro
        const query = `
          INSERT INTO cups (code, name, price, status, category, complexity_level, estimated_duration_minutes)
          VALUES (?, ?, ?, 'Activo', ?, 
            CASE 
              WHEN ? > 100000 THEN 'Alta'
              WHEN ? > 50000 THEN 'Media'
              ELSE 'Baja'
            END,
            CASE 
              WHEN ? > 100000 THEN 60
              WHEN ? > 50000 THEN 45
              ELSE 30
            END
          )
        `;

        await connection.execute(query, [
          code,
          name,
          maxPrice,
          category,
          maxPrice,
          maxPrice,
          maxPrice,
          maxPrice
        ]);

        inserted++;
        
        // Mostrar información sobre precios múltiples
        if (records.length > 1) {
          const prices = [...new Set(records.map(r => r.amount))].sort((a, b) => b - a);
          console.log(`✅ ${code} - ${name.substring(0, 60)}...`);
          console.log(`   💰 Precios encontrados: ${prices.map(p => `$${p.toLocaleString()}`).join(', ')}`);
          console.log(`   ✨ Precio seleccionado: $${maxPrice.toLocaleString()}\n`);
        } else {
          console.log(`✅ ${code} - ${name.substring(0, 60)}... ($${maxPrice.toLocaleString()})`);
        }

      } catch (error: any) {
        errors++;
        console.error(`❌ Error con código ${code}:`, error.message);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('📊 RESUMEN DE IMPORTACIÓN:');
    console.log('='.repeat(80));
    console.log(`📝 Total de registros en CSV: ${allRecords.length}`);
    console.log(`🔢 Códigos únicos procesados: ${codeGroups.size}`);
    console.log(`✅ Registros insertados: ${inserted}`);
    console.log(`⏭️  Registros omitidos: ${skipped}`);
    console.log(`❌ Errores: ${errors}`);
    console.log('='.repeat(80) + '\n');

    // Verificar los datos insertados
    const [rows]: any = await connection.query(
      'SELECT COUNT(*) as total, SUM(price) as total_price, AVG(price) as avg_price, MIN(price) as min_price, MAX(price) as max_price FROM cups WHERE status = "Activo"'
    );
    
    console.log('📈 ESTADÍSTICAS FINALES:');
    console.log('='.repeat(80));
    console.log(`🎯 Total de códigos CUPS en la base de datos: ${rows[0].total}`);
    const totalPrice = rows[0].total_price ? parseFloat(rows[0].total_price) : 0;
    const avgPrice = rows[0].avg_price ? parseFloat(rows[0].avg_price) : 0;
    const minPrice = rows[0].min_price ? parseFloat(rows[0].min_price) : 0;
    const maxPrice = rows[0].max_price ? parseFloat(rows[0].max_price) : 0;
    
    console.log(`💰 Valor total: $${totalPrice.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    console.log(`📊 Precio promedio: $${avgPrice.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    console.log(`📉 Precio mínimo: $${minPrice.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    console.log(`📈 Precio máximo: $${maxPrice.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    console.log('='.repeat(80) + '\n');

    // Mostrar distribución por categoría
    const [categories]: any = await connection.query(
      `SELECT 
        category,
        COUNT(*) as total,
        SUM(price) as total_price,
        AVG(price) as avg_price
       FROM cups 
       WHERE status = 'Activo'
       GROUP BY category 
       ORDER BY total DESC`
    );

    console.log('📂 DISTRIBUCIÓN POR CATEGORÍA:');
    console.log('='.repeat(80));
    (categories as any[]).forEach(cat => {
      const catTotal = parseFloat(cat.total_price) || 0;
      const catAvg = parseFloat(cat.avg_price) || 0;
      console.log(`${cat.category}:`);
      console.log(`   📊 Total de códigos: ${cat.total}`);
      console.log(`   💰 Valor total: $${catTotal.toLocaleString('es-CO')}`);
      console.log(`   📈 Precio promedio: $${catAvg.toLocaleString('es-CO')}`);
      console.log('');
    });
    console.log('='.repeat(80) + '\n');

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
importAllCupsFromCSV()
  .then(() => {
    console.log('\n✅ Importación completada exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error fatal:', error);
    process.exit(1);
  });
