// Shared pool of realistic Filipino names. Deterministic unique combos:
// first + middleInitial + last. 60 first x 60 last x 26 MI = 93k+ unique.
export const MALE_FIRST = ["Jose","Juan","Pedro","Miguel","Andres","Rafael","Manuel","Francisco","Carlos","Diego","Ramon","Eduardo","Ricardo","Danilo","Roberto","Marco","Paolo","Enrico","Gabriel","Emmanuel","Kristoffer","Jeronimo","Alfonso","Santiago","Domingo","Lorenzo","Felipe","Ernesto","Rolando","Renato","Dante","Felix","Hector","Ignacio","Julio","Nestor","Oscar","Pablo","Raul","Reynaldo","Salvador","Teodoro","Victor","Alejandro","Bernardo","Cesar","Dennis","Edgar","Ferdinand","Gerry","Hernan","Isidro","Jayson","Kenneth","Leopoldo","Marlon","Nilo","Orlando","Ramil","Roderick"];
export const FEMALE_FIRST = ["Maria","Ana","Sofia","Elena","Rosa","Carmen","Lucia","Gabriela","Isabella","Paula","Teresa","Liza","Angelica","Bianca","Camille","Danica","Erica","Fatima","Grace","Hazel","Irene","Jasmine","Katrina","Lorena","Marites","Nadia","Olivia","Patricia","Queenie","Rachelle","Regina","Rowena","Samara","Trisha","Vanessa","Winnie","Ysabel","Zarina","Aileen","Bernadette","Clarissa","Divina","Estrella","Florencia","Gwendolyn","Honeylet","Imelda","Jocelyn","Kristina","Ligaya","Mylene","Norma","Odette","Pilar","Rosalinda","Socorro","Teodora","Violeta","Wilma","Corazon"];
export const LAST = ["Santos","Reyes","Cruz","Dela Cruz","Garcia","Mendoza","Torres","Flores","Ramos","Diaz","Castillo","Manalo","Bautista","Villanueva","Ocampo","Aquino","Del Rosario","Gonzales","Fernandez","Lopez","Pascual","Navarro","Salazar","Mercado","Aguilar","Delos Santos","Padilla","Velasco","Rivera","Morales","Rosales","Padilla","Corpuz","Magsaysay","Abad","Roxas","Legaspi","Quezon","Osmeña","Laurel","Recto","Mabini","Bonifacio","Jacinto","Luna","Hidalgo","Soriano","Andrada","Balcita","Calderon","Dimalanta","Escobar","Fajardo","Galang","Herrera","Ibarra","Javier","Lacson","Malvar","Natividad"];
export const MI = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export function buildUniqueNames(count: number, maleCount?: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  let mi = 0, li = 0, fiM = 0, fiF = 0;
  const males = maleCount ?? Math.ceil(count / 2);
  // interleave female/male to keep variety; caller maps by gender instead
  for (let i = 0; out.length < count; i++) {
    const isMale = i % 2 === 0 ? out.filter((_, k) => k % 2 === 0).length < males : out.filter((_, k) => k % 2 === 1).length >= count - males;
    void isMale;
    const useMale = out.length % 2 === 0;
    const first = useMale ? MALE_FIRST[fiM % MALE_FIRST.length] : FEMALE_FIRST[fiF % FEMALE_FIRST.length];
    const last = LAST[li % LAST.length];
    const name = `${first} ${MI[mi % MI.length]}. ${last}`;
    if (!seen.has(name)) { seen.add(name); out.push(name); }
    // advance odometer
    mi++;
    if (mi % MI.length === 0) li++;
    if (li > 0 && li % LAST.length === 0 && mi % MI.length === 0) { if (useMale) fiM++; else fiF++; }
    else if (mi % MI.length === 0) { /* last advanced */ }
    if (i % (MI.length * 2) === 0 && i > 0) { if (useMale) fiM++; else fiF++; }
    if (i > count * 40) break; // safety
  }
  return out;
}

export function buildNamesForGenders(genders: ("Male" | "Female")[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  let mF = 0, fF = 0, l = 0, m = 0;
  for (const g of genders) {
    for (let tries = 0; tries < 10000; tries++) {
      const first = g === "Male" ? MALE_FIRST[(mF + tries) % MALE_FIRST.length] : FEMALE_FIRST[(fF + tries) % FEMALE_FIRST.length];
      const last = LAST[(l + tries) % LAST.length];
      const name = `${first} ${MI[(m + tries) % MI.length]}. ${last}`;
      if (!seen.has(name)) {
        seen.add(name); out.push(name);
        if (g === "Male") mF += 1; else fF += 1;
        l += 1; m += 1;
        break;
      }
    }
  }
  return out;
}
