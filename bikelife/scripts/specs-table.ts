// Affiche les cotes appliquées à chaque véhicule : npx tsx scripts/specs-table.ts
import { BIKES } from '../src/data/bikes';
const pad = (s: string | number, n: number) => String(s).padEnd(n);
console.log(pad('id', 18), pad('référence', 36), pad('emp.', 6), pad('selle', 6), pad('sol', 5), pad('masse', 7), pad('rAV', 6), pad('rAR', 6), pad('jantes', 8), 'comX/comY');
for (const b of BIKES) {
  console.log(pad(b.id, 18), pad(b.real?.ref ?? '-', 36), pad(Math.round(b.wheelbase * 1000), 6), pad(Math.round(b.seatHeight * 1000), 6), pad(Math.round(b.groundClearance * 1000), 5), pad(b.mass, 7), pad(b.rFront.toFixed(3), 6), pad(b.rRear.toFixed(3), 6), pad(`${b.rimFront}/${b.rimRear}`, 8), `${b.comX.toFixed(2)}/${b.comY.toFixed(2)}`);
}
