import { DocumentProjet } from '../models/projet.models';

/**
 * Reconnaitre un fichier technique dans les documents d'un projet.
 *
 * Deux lectures coexistaient et se contredisaient : le bandeau de transition
 * disait « Gerber detecte » pendant que l'ecran de depot affichait « 0 sur 3 ».
 * L'un acceptait un fichier reconnu a son nom, l'autre exigeait le type exact.
 *
 * L'ecart vient de la phase d'etude : le chef de projet y depose ses livrables
 * avec le type generique DOCUMENT_TECHNIQUE. Une archive `gerber.zip` livree
 * ainsi est bien un Gerber, et le nier ferait redemander au client un fichier
 * qu'il a deja entre les mains.
 *
 * Une seule regle, donc, appliquee partout : le type d'abord, le nom ensuite.
 */

type Doc = Pick<DocumentProjet, 'typeDocument' | 'nomDocument' | 'fileUrl'>;

function libelle(d: Doc): string {
  return (d.nomDocument || d.fileUrl || '').toLowerCase();
}

/** Archive de fabrication PCB : .zip, .rar, .7z, ou nommee « gerber ». */
export function estGerber(d: Doc): boolean {
  if (d.typeDocument === 'GERBER') return true;
  const nom = libelle(d);
  return nom.includes('gerber')
      || nom.endsWith('.zip') || nom.endsWith('.rar') || nom.endsWith('.7z');
}

/** Coordonnees de placement : CPL, centroid, pick & place. */
export function estPickAndPlace(d: Doc): boolean {
  if (d.typeDocument === 'PICK_AND_PLACE') return true;
  const nom = libelle(d);
  return nom.includes('pick') || nom.includes('place')
      || nom.includes('cpl') || nom.includes('centroid') || nom.includes('pnp');
}

/** Procedure de montage. */
export function estSop(d: Doc): boolean {
  if (d.typeDocument === 'SOP') return true;
  const nom = libelle(d);
  return nom.includes('sop') || nom.includes('procedure') || nom.includes('instruction');
}

/** Nomenclature : le type, ou une feuille de calcul. */
export function estBom(d: Doc): boolean {
  if (d.typeDocument === 'BOM') return true;
  const nom = libelle(d);
  return nom.includes('bom') || nom.includes('nomenclature');
}

export function aGerber(docs?: Doc[] | null): boolean {
  return !!docs?.some(estGerber);
}

export function aPickAndPlace(docs?: Doc[] | null): boolean {
  return !!docs?.some(estPickAndPlace);
}

export function aSop(docs?: Doc[] | null): boolean {
  return !!docs?.some(estSop);
}

export function aBom(docs?: Doc[] | null): boolean {
  return !!docs?.some(estBom);
}
