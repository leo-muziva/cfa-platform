// Size charts, taken from the supplier's sizing sheet.
// Each section becomes one table on the size guide page.
// "id" is what the #link in the web address points at.

export type SizeSection = {
  id: string;
  title: string;
  note?: string;
  headers: string[];
  rows: string[][];
};

export const SIZE_SECTIONS: SizeSection[] = [
  {
    id: "jacket-pants-women",
    title: "Jacket and pants — women",
    headers: ["EU size", "36", "38", "40", "42", "44", "46", "48", "50"],
    rows: [
      ["Height cm", "158-164", "158-164", "158-164", "164-170", "164-170", "170-176", "170-176", "170-176"],
      ["Chest cm", "80-84", "84-88", "88-92", "92-96", "96-100", "100-104", "104-108", "108-112"],
      ["Waist cm", "60-64", "64-68", "68-72", "72-76", "76-80", "80-84", "84-88", "88-92"],
      ["Hip cm", "87-91", "91-95", "95-99", "99-103", "103-107", "107-111", "111-115", "115-119"],
    ],
  },
  {
    id: "jacket-pants-women-long",
    title: "Jacket and pants — women, special long",
    note: "For taller, slimmer builds.",
    headers: ["EU size", "76", "80", "84", "88", "92"],
    rows: [
      ["Height cm", "170-176", "176-182", "176-182", "182-188", "188-194"],
      ["Chest cm", "84-88", "88-92", "92-96", "96-100", "100-104"],
      ["Waist cm", "64-68", "68-72", "72-76", "76-80", "80-84"],
      ["Hip cm", "91-95", "95-99", "99-103", "103-107", "107-111"],
    ],
  },
  {
    id: "jacket-pants-men",
    title: "Jacket and pants — men",
    headers: ["EU size", "44", "46", "48", "50", "52", "54", "56", "58", "60"],
    rows: [
      ["Height cm", "164-170", "164-170", "170-176", "170-176", "176-182", "176-182", "176-182", "182-188", "182-188"],
      ["Chest cm", "84-88", "88-92", "92-96", "96-100", "100-104", "104-108", "108-112", "112-116", "116-120"],
      ["Waist cm", "72-76", "76-80", "80-84", "84-88", "88-92", "92-96", "96-100", "100-104", "104-108"],
      ["Hip cm", "88-92", "92-96", "96-100", "100-104", "104-108", "108-112", "112-116", "116-120", "120-124"],
    ],
  },
  {
    id: "jacket-pants-men-long",
    title: "Jacket and pants — men, special long",
    note: "For taller, slimmer builds.",
    headers: ["EU size", "98", "102", "106", "110", "114"],
    rows: [
      ["Height cm", "176-182", "176-182", "182-188", "182-188", "188-194"],
      ["Chest cm", "92-96", "96-100", "100-104", "104-108", "108-112"],
      ["Waist cm", "80-84", "84-88", "88-92", "92-96", "96-100"],
      ["Hip cm", "96-100", "100-104", "104-108", "108-112", "112-116"],
    ],
  },
  {
    id: "jacket-pants-kids",
    title: "Jacket and pants — kids",
    note: "Foil and sabre electric lames use these same sizes for kids.",
    headers: ["EU size", "128", "134", "140", "146", "152", "158", "164", "170"],
    rows: [
      ["Age", "7-8", "8-9", "9-10", "10-11", "11-12", "12-13", "13-14", "15"],
      ["Height cm", "122-128", "128-134", "134-140", "140-146", "146-152", "152-158", "158-164", "164-170"],
      ["Chest cm", "64-68", "67-71", "70-74", "73-77", "76-80", "79-83", "82-86", "85-89"],
      ["Waist cm", "59-63", "61-65", "63-67", "65-69", "67-71", "69-73", "71-75", "73-77"],
      ["Hip cm", "70-74", "72-76", "74-78", "76-80", "78-82", "81-85", "84-88", "87-91"],
    ],
  },
  {
    id: "plastron",
    title: "Underarm plastron",
    headers: ["Size", "XXS", "XS", "S", "M", "L", "XL", "XXL"],
    rows: [
      ["Children cm", "128-146", "152-158", "164-170", "-", "-", "-", "-"],
      ["Women (EU)", "-", "-", "36-38", "40-42", "44-46", "48-50", "-"],
      ["Men (EU)", "-", "-", "44-46", "48-50", "52-54", "56-58", "60"],
    ],
  },
  {
    id: "shoes-dowin-low",
    title: "Shoes — Do-Win low-cut",
    note: "Order shoes by EU size. The other sizes are for reference only.",
    headers: ["", "", "", "", "", "", "", "", "", "", "", "", ""],
    rows: [
      ["UK", "2.5", "3.5", "4.5", "5", "5.5", "6.5", "7.5", "8", "9", "9.5", "10.5", "11"],
      ["EU", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46"],
      ["US", "3", "4", "5/4.5", "5.5", "6.5/6", "7", "8", "8.5", "9.5", "10", "11", "11.5"],
      ["CHN", "220", "225", "235", "240", "245", "250", "260", "265", "270", "275", "280", "290"],
    ],
  },
  {
    id: "shoes-dowin-high",
    title: "Shoes — Do-Win high-cut",
    note: "Order shoes by EU size. The other sizes are for reference only.",
    headers: ["", "", "", "", "", "", "", "", "", "", "", "", ""],
    rows: [
      ["UK", "3", "3.5", "4.5", "5", "6", "6.5", "7.5", "8", "9", "9.5", "10.5", "11"],
      ["EU", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46"],
      ["US", "3.5", "4", "5", "5.5", "6.5", "7", "8", "8.5", "9.5", "10", "11", "11.5"],
    ],
  },
  {
    id: "shoes-lining",
    title: "Shoes — LiNing",
    note: "Order shoes by EU size. The other sizes are for reference only.",
    headers: ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    rows: [
      ["UK", "-", "-", "2", "2.5", "3.5", "4", "5", "-", "6.5", "7", "8", "8.5", "9.5", "10", "11"],
      ["EU", "32", "33", "34", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46"],
      ["US", "1.5", "2", "3", "3.5", "4.5", "5", "6", "6.5", "7.5", "8", "9", "9.5", "10.5", "11", "12"],
      ["CHN", "190", "195", "205", "210", "220", "225", "235", "240", "250", "255", "265", "270", "280", "285", "295"],
    ],
  },
  {
    id: "gloves",
    title: "Gloves",
    note: "Measure your hand across the widest part of the palm.",
    headers: ["Size", "6", "6.5", "7", "7.5", "8", "8.5", "9", "9.5", "10", "10.5", "11"],
    rows: [
      ["Width in inches", "6", "6.5", "7", "7.5", "8", "8.5", "9", "9.5", "10", "10.5", "11"],
      ["Width in mm", "150", "162.5", "175", "187.5", "200", "212.5", "225", "237.5", "250", "262.5", "275"],
    ],
  },
  {
    id: "masks",
    title: "Masks",
    note: "Measure around your head, across the forehead.",
    headers: ["Size", "XX-Small", "X-Small", "Small", "Medium", "Large", "X-Large"],
    rows: [
      ["Head cm", "under 53", "53-55", "56-59", "60-65", "66-69", "70-72"],
    ],
  },
  {
    id: "lame-men",
    title: "Electric lame — men",
    headers: ["EU size", "38", "40", "42", "44", "46", "48", "50", "52", "54", "56", "58", "60"],
    rows: [
      ["Height cm", "162", "168", "168", "174", "180", "186", "186", "186", "186", "192", "192", "192"],
      ["Chest cm", "76", "80", "84", "88", "92", "96", "100", "104", "108", "112", "116", "120"],
    ],
  },
  {
    id: "lame-women",
    title: "Electric lame — women",
    headers: ["EU size", "36", "38", "40", "42", "44", "46", "48", "50"],
    rows: [
      ["Height cm", "158-164", "158-164", "158-164", "164-170", "164-170", "170-176", "170-176", "170-176"],
      ["Chest cm", "84", "88", "92", "96", "100", "104", "108", "112"],
    ],
  },
  {
    id: "chest-protector",
    title: "Chest protector",
    headers: ["Size", "XXS", "XS", "S", "M", "L", "XL"],
    rows: [
      ["Boy (chest cm)", "under 64", "64-80", "80-88", "-", "-", "-"],
      ["Girl (chest cm)", "-", "64-80", "80-88", "-", "-", "-"],
      ["Women (chest cm)", "-", "-", "80-88", "88-96", "96-104", "104-112"],
      ["Men (chest cm)", "-", "-", "84-92", "92-100", "100-108", "108-120"],
    ],
  },
  {
    id: "socks",
    title: "Fencing socks",
    headers: ["Size", "Leg length", "Sole length"],
    rows: [
      ["XXS", "35cm", "14cm"],
      ["XS", "39cm", "16cm"],
      ["S", "41cm", "18cm"],
      ["M", "43cm", "20cm"],
      ["L", "45cm", "22cm"],
      ["XL", "47cm", "24cm"],
    ],
  },
];

// Works out which chart a product should link to, from its name.
// First match wins, so the more specific rules go first.
const RULES: { match: RegExp; id: string }[] = [
  { match: /lame/i, id: "lame-men" },
  { match: /chest protector|breast cup/i, id: "chest-protector" },
  { match: /plastron|underarm|under plastron/i, id: "plastron" },
  { match: /sock/i, id: "socks" },
  { match: /glove|cuff/i, id: "gloves" },
  { match: /mask/i, id: "masks" },
  { match: /li-?ning/i, id: "shoes-lining" },
  { match: /high-?cut/i, id: "shoes-dowin-high" },
  { match: /shoe/i, id: "shoes-dowin-low" },
  { match: /jacket|pants|breech|vest|sleeve|leg cover/i, id: "jacket-pants-men" },
];

// Returns the web address of the right chart, or null if the product
// does not match any of them.
export function sizeGuideHref(productName: string): string | null {
  for (const rule of RULES) {
    if (rule.match.test(productName)) {
      return "/protected/shop/size-guide#" + rule.id;
    }
  }
  return null;
}