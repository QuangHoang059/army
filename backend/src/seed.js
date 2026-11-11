import { db, clearUploads } from './db.js';
import { buildSeed } from './seed-data.js';

/** Insert the sample dataset. Returns counts. Throws if data exists unless reset=true. */
export function seed({ reset = false } = {}) {
  const run = db.transaction(() => {
    if (reset) {
      db.exec('DELETE FROM loans; DELETE FROM maintenance; DELETE FROM weapons;');
      db.exec("DELETE FROM sqlite_sequence WHERE name IN ('loans','maintenance','weapons');");
    } else {
      const { n } = db.prepare('SELECT COUNT(*) AS n FROM weapons').get();
      if (n > 0) {
        const err = new Error('Đã có dữ liệu vũ khí, không nạp lại dữ liệu mẫu.');
        err.status = 409;
        throw err;
      }
    }

    const { weapons, maintenance, loans } = buildSeed();
    const insW = db.prepare(`INSERT INTO weapons (code,name,serial,type,unit,responsible,status,last_maint,next_maint)
      VALUES (@code,@name,@serial,@type,@unit,@responsible,@status,@last,@next)`);
    const idOf = db.prepare('SELECT id FROM weapons WHERE code = ?');
    const insM = db.prepare(`INSERT INTO maintenance (weapon_id,date,content,worker,result,next_date)
      VALUES (?,?,?,?,?,?)`);
    const insL = db.prepare(`INSERT INTO loans (weapon_id,borrower,purpose,borrow_at,return_at,return_status,status)
      VALUES (?,?,?,?,?,?,?)`);

    for (const w of weapons) insW.run(w);
    for (const m of maintenance)
      insM.run(idOf.get(m.weaponCode).id, m.date, m.content, m.worker, m.result, m.nextDate);
    for (const l of loans)
      insL.run(idOf.get(l.weaponCode).id, l.borrower, l.purpose, l.borrowAt, l.returnAt, l.returnStatus, l.status);

    return { weapons: weapons.length, maintenance: maintenance.length, loans: loans.length };
  });
  const out = run();
  if (reset) clearUploads();
  return out;
}

// CLI: `node src/seed.js [--reset]`
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('src/seed.js')) {
  try {
    const reset = process.argv.includes('--reset');
    if (reset) {
      const { backupNow } = await import('./backup.js');
      const b = await backupNow('before-reset');
      console.log(`Đã sao lưu trước khi nạp lại: ${b.name}`);
    }
    const out = seed({ reset });
    console.log('Seeded:', out);
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
